import type { RecordAgentThoughtCmd } from "../../types.ts";
import type { EmitFn } from "../slice-types.ts";

export async function handleRecordAgentThought(sessionId: string, command: RecordAgentThoughtCmd, emit: EmitFn) {
  await emit(sessionId, { type: "AgentThought", text: command.text });
}
