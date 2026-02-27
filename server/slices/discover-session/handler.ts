import type { DiscoverSessionCmd } from "../../types.ts";
import type { EmitFn } from "../slice-types.ts";

export async function handleDiscoverSession(sessionId: string, command: DiscoverSessionCmd, emit: EmitFn) {
  await emit(sessionId, {
    type: "SessionDiscovered",
    name: command.name,
    title: command.title,
    createdAt: command.createdAt,
  });
}
