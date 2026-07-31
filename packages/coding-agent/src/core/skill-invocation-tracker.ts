export type SkillInvocationOutcome = "success" | "tool_error" | "agent_error" | "aborted" | "unknown";

export type SkillInvocationSource = "explicit-slash" | "model-read" | "sdk";

export interface SkillInvocationStart {
	invocationId?: string;
	skillName: string;
	location: string;
	baseDir?: string;
	source: SkillInvocationSource;
}

export interface SkillInvocationTiming {
	invocationId: string;
	skillName: string;
	location: string;
	baseDir?: string;
	source: SkillInvocationSource;
	startedAt: string;
	endedAt: string;
	durationMs: number;
	outcome: SkillInvocationOutcome;
	toolCount: number;
	errorCount: number;
	lastAssistantStopReason?: string;
}

interface SkillInvocationTrace extends SkillInvocationStart {
	invocationId: string;
	startedAt: string;
	startedAtMs: number;
	toolCount: number;
	errorCount: number;
	lastAssistantStopReason?: string;
}

export const SKILL_TIMING_CUSTOM_TYPE = "skill_timing";

export function isSkillInvocationTiming(value: unknown): value is SkillInvocationTiming {
	if (!value || typeof value !== "object") return false;
	const candidate = value as Partial<SkillInvocationTiming>;
	return (
		typeof candidate.invocationId === "string" &&
		typeof candidate.skillName === "string" &&
		typeof candidate.location === "string" &&
		typeof candidate.source === "string" &&
		typeof candidate.startedAt === "string" &&
		typeof candidate.endedAt === "string" &&
		typeof candidate.durationMs === "number" &&
		typeof candidate.outcome === "string" &&
		typeof candidate.toolCount === "number" &&
		typeof candidate.errorCount === "number"
	);
}

export function formatSkillInvocationDuration(durationMs: number): string {
	const safeMs = Math.max(0, durationMs);
	if (safeMs < 1000) return `${Math.round(safeMs)}ms`;
	if (safeMs < 60_000) return `${(safeMs / 1000).toFixed(safeMs < 10_000 ? 1 : 0)}s`;
	const minutes = Math.floor(safeMs / 60_000);
	const seconds = Math.round((safeMs % 60_000) / 1000);
	return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

export class SkillInvocationTracker {
	private nextId = 1;
	private readonly active = new Map<string, SkillInvocationTrace>();

	start(invocation: SkillInvocationStart): string {
		const invocationId = invocation.invocationId ?? `skill-${this.nextId++}`;
		this.active.set(invocationId, {
			...invocation,
			invocationId,
			startedAt: new Date().toISOString(),
			startedAtMs: performance.now(),
			toolCount: 0,
			errorCount: 0,
		});
		return invocationId;
	}

	observeToolEnd(isError: boolean): void {
		for (const trace of this.active.values()) {
			trace.toolCount++;
			if (isError) trace.errorCount++;
		}
	}

	observeAssistantEnd(stopReason: string | undefined): void {
		if (!stopReason) return;
		for (const trace of this.active.values()) {
			trace.lastAssistantStopReason = stopReason;
		}
	}

	settleAll(options: { aborted?: boolean; agentError?: boolean } = {}): SkillInvocationTiming[] {
		const endedAt = new Date().toISOString();
		const endedAtMs = performance.now();
		const results = Array.from(this.active.values()).map((trace) => {
			const outcome = getOutcome(trace, options);
			return {
				invocationId: trace.invocationId,
				skillName: trace.skillName,
				location: trace.location,
				baseDir: trace.baseDir,
				source: trace.source,
				startedAt: trace.startedAt,
				endedAt,
				durationMs: Math.max(0, Math.round(endedAtMs - trace.startedAtMs)),
				outcome,
				toolCount: trace.toolCount,
				errorCount: trace.errorCount,
				lastAssistantStopReason: trace.lastAssistantStopReason,
			};
		});
		this.active.clear();
		return results;
	}
}

function getOutcome(
	trace: SkillInvocationTrace,
	options: { aborted?: boolean; agentError?: boolean },
): SkillInvocationOutcome {
	if (options.aborted || trace.lastAssistantStopReason === "aborted") return "aborted";
	if (options.agentError || trace.lastAssistantStopReason === "error") return "agent_error";
	if (trace.errorCount > 0) return "tool_error";
	return "success";
}
