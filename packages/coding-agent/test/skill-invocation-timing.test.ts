import { describe, expect, test } from "vitest";
import { formatSkillInvocationDuration, type SkillInvocationTiming } from "../src/core/skill-invocation-tracker.ts";
import { SkillInvocationMessageComponent } from "../src/modes/interactive/components/skill-invocation-message.ts";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";
import { stripAnsi } from "../src/utils/ansi.ts";

const skillBlock = {
	name: "grilling",
	location: "/tmp/skills/grilling/SKILL.md",
	invocationId: "skill-1",
	content: "Do the work.",
	userMessage: undefined,
};

function createTiming(overrides: Partial<SkillInvocationTiming> = {}): SkillInvocationTiming {
	return {
		invocationId: "skill-1",
		skillName: "grilling",
		location: "/tmp/skills/grilling/SKILL.md",
		source: "explicit-slash",
		startedAt: "2026-08-01T00:00:00.000Z",
		endedAt: "2026-08-01T00:00:24.800Z",
		durationMs: 24_800,
		outcome: "success",
		toolCount: 1,
		errorCount: 0,
		...overrides,
	};
}

describe("skill invocation timing", () => {
	test("keeps invocation id on rendered skill block", () => {
		expect(skillBlock.invocationId).toBe("skill-1");
	});

	test("formats skill invocation durations", () => {
		expect(formatSkillInvocationDuration(240)).toBe("240ms");
		expect(formatSkillInvocationDuration(1_250)).toBe("1.3s");
		expect(formatSkillInvocationDuration(24_800)).toBe("25s");
		expect(formatSkillInvocationDuration(65_000)).toBe("1m 5s");
	});

	test("renders successful timing in collapsed skill header", () => {
		initTheme("dark");
		const component = new SkillInvocationMessageComponent(skillBlock, undefined, createTiming());

		const rendered = stripAnsi(component.render(80).join("\n"));

		expect(rendered).toContain("[skill] grilling · ✓ 25s");
	});

	test("updates collapsed skill header when timing arrives", () => {
		initTheme("dark");
		const component = new SkillInvocationMessageComponent(skillBlock);

		expect(stripAnsi(component.render(80).join("\n"))).not.toContain("✗");

		component.setTiming(createTiming({ durationMs: 1_250, outcome: "tool_error", errorCount: 1 }));

		expect(stripAnsi(component.render(80).join("\n"))).toContain("[skill] grilling · ✗ 1.3s");
	});
});
