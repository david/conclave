import { describe, test, expect } from "bun:test";
import { gitStatusUpdatedSlice } from "./projector.ts";
import { initialState } from "../../types.ts";
import type { ClientEvent, GitFileEntry } from "../../types.ts";

const sampleFiles: GitFileEntry[] = [
  { path: "src/app.ts", indexStatus: "M", workTreeStatus: " ", linesAdded: 10, linesDeleted: 2 },
  { path: "README.md", indexStatus: " ", workTreeStatus: "M", linesAdded: 1, linesDeleted: 0 },
];

function makeGitStatusUpdated(files: GitFileEntry[]): ClientEvent {
  return {
    type: "GitStatusUpdated",
    files,
    seq: 1,
    timestamp: Date.now(),
  };
}

describe("gitStatusUpdatedSlice", () => {
  test("stores event.files into state.gitFiles", () => {
    const state = gitStatusUpdatedSlice(initialState, makeGitStatusUpdated(sampleFiles));
    expect(state.gitFiles).toEqual(sampleFiles);
  });

  test("replaces previous gitFiles on subsequent events", () => {
    const stateWithFiles = { ...initialState, gitFiles: sampleFiles };
    const newFiles: GitFileEntry[] = [
      { path: "new.ts", indexStatus: "A", workTreeStatus: " ", linesAdded: 5, linesDeleted: 0 },
    ];
    const state = gitStatusUpdatedSlice(stateWithFiles, makeGitStatusUpdated(newFiles));
    expect(state.gitFiles).toEqual(newFiles);
  });

  test("ignores unrelated events", () => {
    const event = { type: "AgentText", text: "hi", seq: 1, timestamp: Date.now(), sessionId: "s1" } as ClientEvent;
    const state = gitStatusUpdatedSlice(initialState, event);
    expect(state).toBe(initialState);
  });
});
