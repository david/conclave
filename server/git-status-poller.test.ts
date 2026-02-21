import { describe, test, expect } from "bun:test";
import { parseGitStatus, parseNumstat, mergeGitData } from "./git-status-poller.ts";

describe("parseGitStatus", () => {
  test("parses modified file", () => {
    const result = parseGitStatus(" M src/app.ts\n");
    expect(result).toEqual([
      { path: "src/app.ts", indexStatus: " ", workTreeStatus: "M" },
    ]);
  });

  test("parses staged added file", () => {
    const result = parseGitStatus("A  newfile.ts\n");
    expect(result).toEqual([
      { path: "newfile.ts", indexStatus: "A", workTreeStatus: " " },
    ]);
  });

  test("parses deleted file", () => {
    const result = parseGitStatus(" D old.ts\n");
    expect(result).toEqual([
      { path: "old.ts", indexStatus: " ", workTreeStatus: "D" },
    ]);
  });

  test("parses renamed file using destination path", () => {
    const result = parseGitStatus("R  old-name.ts -> new-name.ts\n");
    expect(result).toEqual([
      { path: "new-name.ts", indexStatus: "R", workTreeStatus: " " },
    ]);
  });

  test("parses untracked file", () => {
    const result = parseGitStatus("?? untracked.ts\n");
    expect(result).toEqual([
      { path: "untracked.ts", indexStatus: "?", workTreeStatus: "?" },
    ]);
  });

  test("filters out ignored files", () => {
    const result = parseGitStatus("!! ignored.ts\n");
    expect(result).toEqual([]);
  });

  test("handles empty output (clean working tree)", () => {
    const result = parseGitStatus("");
    expect(result).toEqual([]);
  });

  test("parses multiple entries", () => {
    const raw = [
      " M src/app.ts",
      "A  newfile.ts",
      "?? untracked.ts",
      "!! ignored.ts",
    ].join("\n") + "\n";
    const result = parseGitStatus(raw);
    expect(result).toEqual([
      { path: "src/app.ts", indexStatus: " ", workTreeStatus: "M" },
      { path: "newfile.ts", indexStatus: "A", workTreeStatus: " " },
      { path: "untracked.ts", indexStatus: "?", workTreeStatus: "?" },
    ]);
  });
});

describe("parseNumstat", () => {
  test("parses normal entries", () => {
    const result = parseNumstat("10\t5\tsrc/app.ts\n3\t1\tlib/util.ts\n");
    expect(result).toEqual([
      { path: "src/app.ts", added: 10, deleted: 5 },
      { path: "lib/util.ts", added: 3, deleted: 1 },
    ]);
  });

  test("parses binary file entries (dash/dash) as 0/0", () => {
    const result = parseNumstat("-\t-\timage.png\n");
    expect(result).toEqual([
      { path: "image.png", added: 0, deleted: 0 },
    ]);
  });

  test("handles empty output", () => {
    const result = parseNumstat("");
    expect(result).toEqual([]);
  });
});

describe("mergeGitData", () => {
  test("joins status and numstat data", () => {
    const statusEntries = [
      { path: "src/app.ts", indexStatus: " " as const, workTreeStatus: "M" as const },
    ];
    const stagedNumstat = [] as { path: string; added: number; deleted: number }[];
    const unstagedNumstat = [
      { path: "src/app.ts", added: 10, deleted: 5 },
    ];
    const result = mergeGitData(statusEntries, stagedNumstat, unstagedNumstat);
    expect(result).toEqual([
      { path: "src/app.ts", indexStatus: " ", workTreeStatus: "M", linesAdded: 10, linesDeleted: 5 },
    ]);
  });

  test("assigns 0/0 to untracked files", () => {
    const statusEntries = [
      { path: "untracked.ts", indexStatus: "?" as const, workTreeStatus: "?" as const },
    ];
    const result = mergeGitData(statusEntries, [], []);
    expect(result).toEqual([
      { path: "untracked.ts", indexStatus: "?", workTreeStatus: "?", linesAdded: 0, linesDeleted: 0 },
    ]);
  });

  test("sums staged + unstaged line counts for files appearing in both", () => {
    const statusEntries = [
      { path: "src/app.ts", indexStatus: "M" as const, workTreeStatus: "M" as const },
    ];
    const stagedNumstat = [
      { path: "src/app.ts", added: 3, deleted: 1 },
    ];
    const unstagedNumstat = [
      { path: "src/app.ts", added: 7, deleted: 4 },
    ];
    const result = mergeGitData(statusEntries, stagedNumstat, unstagedNumstat);
    expect(result).toEqual([
      { path: "src/app.ts", indexStatus: "M", workTreeStatus: "M", linesAdded: 10, linesDeleted: 5 },
    ]);
  });

  test("uses staged numstat for index-only changes", () => {
    const statusEntries = [
      { path: "staged.ts", indexStatus: "A" as const, workTreeStatus: " " as const },
    ];
    const stagedNumstat = [
      { path: "staged.ts", added: 20, deleted: 0 },
    ];
    const result = mergeGitData(statusEntries, stagedNumstat, []);
    expect(result).toEqual([
      { path: "staged.ts", indexStatus: "A", workTreeStatus: " ", linesAdded: 20, linesDeleted: 0 },
    ]);
  });
});
