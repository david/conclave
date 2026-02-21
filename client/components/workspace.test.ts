import { describe, test, expect } from "bun:test";
import { groupGitFiles, GitFileRow, filesSummary } from "./workspace.tsx";
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

describe("GitFileRow", () => {
  function findByClass(node: any, className: string): any[] {
    const results: any[] = [];
    if (!node) return results;
    if (node.props?.className === className) results.push(node);
    const children = node.props?.children;
    if (Array.isArray(children)) {
      for (const child of children) {
        results.push(...findByClass(child, className));
      }
    } else if (children && typeof children === "object") {
      results.push(...findByClass(children, className));
    }
    return results;
  }

  test("renders +N and -N for files with non-zero line counts", () => {
    const file: GitFileEntry = { path: "src/foo.ts", indexStatus: "M", workTreeStatus: " ", linesAdded: 10, linesDeleted: 3 };
    const result = GitFileRow({ file, displayStatus: "M" });
    const additions = findByClass(result, "git-file__additions");
    const deletions = findByClass(result, "git-file__deletions");
    expect(additions.length).toBe(1);
    expect(additions[0].props.children).toBe("+10");
    expect(deletions.length).toBe(1);
    expect(deletions[0].props.children).toBe("-3");
  });

  test("renders no indicators for files with 0/0 line counts (untracked)", () => {
    const file: GitFileEntry = { path: "new-file.ts", indexStatus: "?", workTreeStatus: "?", linesAdded: 0, linesDeleted: 0 };
    const result = GitFileRow({ file, displayStatus: "?" });
    const additions = findByClass(result, "git-file__additions");
    const deletions = findByClass(result, "git-file__deletions");
    expect(additions.length).toBe(0);
    expect(deletions.length).toBe(0);
  });

  test("renders only additions when deletions are 0", () => {
    const file: GitFileEntry = { path: "added.ts", indexStatus: "A", workTreeStatus: " ", linesAdded: 20, linesDeleted: 0 };
    const result = GitFileRow({ file, displayStatus: "A" });
    const additions = findByClass(result, "git-file__additions");
    const deletions = findByClass(result, "git-file__deletions");
    expect(additions.length).toBe(1);
    expect(additions[0].props.children).toBe("+20");
    expect(deletions.length).toBe(1);
    expect(deletions[0].props.children).toBe("-0");
  });
});

describe("filesSummary", () => {
  test("includes total added and deleted in summary", () => {
    const files: GitFileEntry[] = [
      { path: "a.ts", indexStatus: "M", workTreeStatus: " ", linesAdded: 10, linesDeleted: 3 },
      { path: "b.ts", indexStatus: "M", workTreeStatus: " ", linesAdded: 5, linesDeleted: 7 },
    ];
    const result = filesSummary(files);
    expect(result).toContain("2 files");
    expect(result).toContain("+15");
    expect(result).toContain("-10");
  });

  test("single file uses singular form", () => {
    const files: GitFileEntry[] = [
      { path: "a.ts", indexStatus: "M", workTreeStatus: " ", linesAdded: 1, linesDeleted: 0 },
    ];
    const result = filesSummary(files);
    expect(result).toContain("1 file");
    expect(result).toContain("+1");
    expect(result).toContain("-0");
  });

  test("omits line counts when all zeros", () => {
    const files: GitFileEntry[] = [
      { path: "new.ts", indexStatus: "?", workTreeStatus: "?", linesAdded: 0, linesDeleted: 0 },
    ];
    const result = filesSummary(files);
    expect(result).toContain("1 file");
    expect(result).not.toContain("+");
    expect(result).not.toContain("-");
  });
});
