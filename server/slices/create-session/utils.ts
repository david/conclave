import type { SessionRegistryState } from "../../server-state.ts";

const NEW_SESSION_RE = /^New Session(?: #(\d+))?$/;

/** Count how many sessions already have a "New Session" / "New Session #N" name. */
export function nextNewSessionName(state: SessionRegistryState): string {
  let count = 0;
  for (const meta of state.sessions.values()) {
    if (NEW_SESSION_RE.test(meta.name)) count++;
  }
  return count === 0 ? "New Session" : `New Session #${count + 1}`;
}
