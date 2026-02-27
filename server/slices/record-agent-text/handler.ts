import type { RecordAgentTextCmd } from "../../types.ts";
import type { EmitFn } from "../slice-types.ts";

export async function handleRecordAgentText(sessionId: string, command: RecordAgentTextCmd, emit: EmitFn) {
  await emit(sessionId, { type: "AgentText", text: command.text });
}
