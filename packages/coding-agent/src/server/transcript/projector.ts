import type { AgentMessage, SessionTreeEntry } from "@earendil-works/pi-agent-core";
import type { AssistantMessage, ToolResultMessage, UserMessage } from "@earendil-works/pi-ai";
import type { JsonValue, ToolTranscriptItem, TranscriptItem } from "@earendil-works/pi-protocol";
import {
	sanitizeProtocolDetails,
	toProtocolAssistantMessage,
	toProtocolJsonValue,
	toProtocolToolResultMessage,
	toProtocolUsage,
	toProtocolUserMessage,
} from "@earendil-works/pi-server";

export { sanitizeProtocolDetails as toDiagnosticJsonValue, toProtocolUsage as normalizeUsage };

function timestamp(value: number): number {
	if (!Number.isFinite(value) || value < 0) throw new Error(`Invalid message timestamp: ${value}`);
	return Math.floor(value);
}

export function normalizedMessageId(message: AgentMessage): string {
	if (message.role === "toolResult") return `tool-${message.toolCallId || timestamp(message.timestamp)}`;
	return `${message.role}-${timestamp(message.timestamp)}`;
}

export function normalizeAssistantMessage(
	message: AssistantMessage,
	streaming = false,
	id = normalizedMessageId(message),
) {
	return toProtocolAssistantMessage(streaming ? { ...message, stopReason: "pending" } : message, { id });
}

export function normalizeUserMessage(message: UserMessage, id = normalizedMessageId(message)) {
	return toProtocolUserMessage(message, { id });
}

interface ToolCallInfo {
	toolName: string;
	input: JsonValue;
}

export function normalizeToolMessage(
	message: ToolResultMessage,
	call?: ToolCallInfo,
	id = normalizedMessageId(message),
): ToolTranscriptItem {
	return toProtocolToolResultMessage(message, {
		id,
		call: {
			toolName: message.toolName || call?.toolName || "unknown",
			input: call?.input ?? null,
		},
	});
}

export function isAssistantMessage(message: AgentMessage): message is AssistantMessage {
	return message.role === "assistant";
}

export function isUserMessage(message: AgentMessage): message is UserMessage {
	return message.role === "user";
}

export function isToolResultMessage(message: AgentMessage): message is ToolResultMessage {
	return message.role === "toolResult";
}

export function normalizeBranchTranscript(entries: readonly SessionTreeEntry[]): TranscriptItem[] {
	const calls = new Map<string, ToolCallInfo>();
	const transcript: TranscriptItem[] = [];
	for (const entry of entries) {
		if (entry.type !== "message") continue;
		const message = entry.message;
		if (isUserMessage(message)) {
			transcript.push(normalizeUserMessage(message, entry.id));
			continue;
		}
		if (isAssistantMessage(message)) {
			for (const part of message.content) {
				if (part.type === "toolCall") {
					calls.set(part.id, {
						toolName: part.name,
						input: toProtocolJsonValue(part.arguments),
					});
				}
			}
			transcript.push(normalizeAssistantMessage(message, false, entry.id));
			continue;
		}
		if (isToolResultMessage(message)) {
			transcript.push(normalizeToolMessage(message, calls.get(message.toolCallId), entry.id));
		}
	}
	return transcript;
}
