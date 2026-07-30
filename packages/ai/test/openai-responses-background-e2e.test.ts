import { describe, expect, it } from "vitest";
import { contentText } from "../src/index.ts";
import { createModels } from "../src/models.ts";
import { openaiProvider } from "../src/providers/openai.ts";
import type { AssistantMessageEvent, Context } from "../src/types.ts";

const POLL_INTERVAL_MS = 2_000;
const MAX_WAIT_MS = 2 * 60 * 1_000;
const EXPECTED_TEXT = "openai background e2e success";

describe.skipIf(!process.env.OPENAI_API_KEY)("OpenAI Responses background mode e2e", () => {
	it("submits and redeems a background response", { retry: 1, timeout: MAX_WAIT_MS + 30_000 }, async () => {
		const models = createModels();
		models.setProvider(openaiProvider());
		const model = models.getModel("openai", "gpt-5.4-mini");
		if (!model) throw new Error("OpenAI model gpt-5.4-mini is not available");

		const context: Context = {
			systemPrompt: "Reply exactly as requested.",
			messages: [
				{
					role: "user",
					content: `Reply with exactly: ${EXPECTED_TEXT}`,
					timestamp: Date.now(),
				},
			],
		};
		const events: AssistantMessageEvent[] = [];
		const responseStream = models.streamSimple(model, context, {
			apiKey: process.env.OPENAI_API_KEY!,
			deferred: true,
			reasoning: "high",
		});
		for await (const event of responseStream) events.push(event);

		let response = await responseStream.result();
		const deadline = Date.now() + MAX_WAIT_MS;
		try {
			expect(response.stopReason, response.errorMessage).toBe("deferred");
			expect(response.deferred?.id).toBeTruthy();
			expect(events.map((event) => event.type)).toEqual(["start", "done"]);
			expect(events.at(-1)).toMatchObject({ type: "done", reason: "deferred" });

			while (response.stopReason === "deferred") {
				const handle = response.deferred;
				if (!handle) throw new Error("Deferred response did not include a handle");
				if (Date.now() >= deadline) throw new Error(`Response ${handle.id} did not complete before timeout`);

				await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
				response = await models.fetchDeferred(model, handle, { apiKey: process.env.OPENAI_API_KEY! });
			}

			expect(response.stopReason, response.errorMessage).toBe("stop");
			expect(contentText(response.content)).toContain(EXPECTED_TEXT);
			expect(response.usage.totalTokens).toBeGreaterThan(0);
		} finally {
			if (response.stopReason === "deferred" && response.deferred) {
				try {
					await models.cancelDeferred(model, response.deferred, { apiKey: process.env.OPENAI_API_KEY! });
				} catch {
					// Best-effort cleanup must not hide the original test failure.
				}
			}
		}
	});
});
