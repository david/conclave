import { describe, test, expect } from "bun:test";
import { groupGitFiles } from "./workspace.tsx";
import type { GitFileEntry } from "../types.ts";

describe("groupGitFiles", () => {
  test("partitions staged files (indexStatus not ' ' or '?')", () => {
    const files: GitFileEntry[] = [
      { path: "staged.ts", indexStatus: "M", workTreeStatus: " ", linesAdded: 5, linesDeleted: 1 },
      { path: "unstaged.ts", indexStatus: " ", workTreeStatus: "M", linesAdded: 2, linesDeleted: 0 },
    ];
    const result = groupGitFiles(files);
    expect(result.staged).toEqual([files[0]]);
    expect(result.unstaged).toEqual([files[1]]);
    expect(result.untracked).toEqual([]);
  });

  test("classifies untracked files (both statuses are '?')", () => {
    const files: GitFileEntry[] = [
      { path: "new-file.ts", indexStatus: "?", workTreeStatus: "?", linesAdded: 0, linesDeleted: 0 },
    ];
    const result = groupGitFiles(files);
    expect(result.staged).toEqual([]);
    expect(result.unstaged).toEqual([]);
    expect(result.untracked).toEqual([files[0]]);
  });

  test("puts a file with both index and work-tree changes into both staged and unstaged", () => {
    const files: GitFileEntry[] = [
      { path: "both.ts", indexStatus: "M", workTreeStatus: "M", linesAdded: 10, linesDeleted: 3 },
    ];
    const result = groupGitFiles(files);
    expect(result.staged).toEqual([files[0]]);
    expect(result.unstaged).toEqual([files[0]]);
    expect(result.untracked).toEqual([]);
  });

  test("handles empty input", () => {
    const result = groupGitFiles([]);
    expect(result.staged).toEqual([]);
    expect(result.unstaged).toEqual([]);
    expect(result.untracked).toEqual([]);
  });

  test("handles added files as staged", () => {
    const files: GitFileEntry[] = [
      { path: "new.ts", indexStatus: "A", workTreeStatus: " ", linesAdded: 20, linesDeleted: 0 },
    ];
    const result = groupGitFiles(files);
    expect(result.staged).toEqual([files[0]]);
    expect(result.unstaged).toEqual([]);
  });

  test("handles deleted files", () => {
    const files: GitFileEntry[] = [
      { path: "old.ts", indexStatus: "D", workTreeStatus: " ", linesAdded: 0, linesDeleted: 15 },
    ];
    const result = groupGitFiles(files);
    expect(result.staged).toEqual([files[0]]);
    expect(result.unstaged).toEqual([]);
  });
});
