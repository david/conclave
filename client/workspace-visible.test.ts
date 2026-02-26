import { describe, test, expect } from "bun:test";
import { isWorkspaceVisible } from "./workspace-visible.ts";
import type { AppState } from "./types.ts";

type WorkspaceState = Pick<AppState, "sessionId" | "planEntries" | "gitFiles" | "specs" | "services">;

function emptyState(overrides: Partial<WorkspaceState> = {}): WorkspaceState {
  return {
    sessionId: null,
    planEntries: [],
    gitFiles: [],
    specs: [],
    services: [],
    ...overrides,
  };
}

describe("isWorkspaceVisible", () => {
  test("desktop, no content — returns true", () => {
    const state = emptyState();
    expect(isWorkspaceVisible(false, state)).toBe(true);
  });

  test("desktop, with content — returns true", () => {
    const state = emptyState({
      sessionId: "s1",
      planEntries: [{ content: "task", status: "pending", priority: "high" }],
    });
    expect(isWorkspaceVisible(false, state)).toBe(true);
  });

  test("mobile, no content — returns false", () => {
    const state = emptyState({
      sessionId: "s1",
    });
    expect(isWorkspaceVisible(true, state)).toBe(false);
  });

  test("mobile, with content — returns true", () => {
    const state = emptyState({
      sessionId: "s1",
      gitFiles: [{ path: "file.ts", indexStatus: "M", workTreeStatus: " ", linesAdded: 1, linesDeleted: 0 }],
    });
    expect(isWorkspaceVisible(true, state)).toBe(true);
  });

  test("mobile, no session — returns false", () => {
    const state = emptyState({
      planEntries: [{ content: "task", status: "pending", priority: "high" }],
    });
    expect(isWorkspaceVisible(true, state)).toBe(false);
  });
});
