import type { ProviderStreams } from "../types.ts";
import { lazyApi } from "./lazy.ts";

export const openAIResponsesApi = (capabilities?: { deferred?: boolean }): ProviderStreams =>
	lazyApi(() => import("./openai-responses.ts"), capabilities);
