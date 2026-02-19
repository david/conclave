import { describe, test, expect } from "bun:test";
import { nextNewSessionName } from "./utils.ts";
import type { SessionRegistryState, SessionMeta } from "../server-state.ts";

function makeState(...names: string[]): SessionRegistryState {
  const sessions = new Map<string, SessionMeta>();
  for (let i = 0; i < names.length; i++) {
    sessions.set(`s${i + 1}`, {
      sessionId: `s${i + 1}`,
      name: names[i],
      title: null,
      firstPrompt: null,
      loaded: true,
      createdAt: i,
    });
  }
  return { sessions, sessionCounter: names.length };
}

describe("nextNewSessionName", () => {
  test("returns 'New Session' when no sessions exist", () => {
    expect(nextNewSessionName(makeState())).toBe("New Session");
  });

  test("returns 'New Session' when existing sessions all have custom names", () => {
    expect(nextNewSessionName(makeState("My Chat", "Debug help"))).toBe("New Session");
  });

  test("returns '#2' when one 'New Session' already exists", () => {
    expect(nextNewSessionName(makeState("New Session"))).toBe("New Session #2");
  });

  test("returns '#3' when two new sessions already exist", () => {
    expect(nextNewSessionName(makeState("New Session", "New Session #2"))).toBe("New Session #3");
  });

  test("ignores sessions with titles that don't match the pattern", () => {
    expect(nextNewSessionName(makeState("New Session", "My titled session"))).toBe("New Session #2");
  });

  test("counts correctly with mixed named and new sessions", () => {
    expect(nextNewSessionName(makeState("My Chat", "New Session", "Debug help", "New Session #2"))).toBe("New Session #3");
  });
});
