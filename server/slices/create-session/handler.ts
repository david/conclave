import type { CreateSessionCmd } from "../../types.ts";
import type { EmitFn, BridgeLike } from "../slice-types.ts";

export async function handleCreateSession(_sessionId: string, _command: CreateSessionCmd, emit: EmitFn, bridge: BridgeLike) {
  const newSessionId = await bridge.createSession();
  await emit(newSessionId, { type: "SessionCreated" });
}
