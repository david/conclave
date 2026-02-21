import type { GitFileEntry, GitFileStatus } from "./types.ts";

type StatusEntry = {
  path: string;
  indexStatus: string;
  workTreeStatus: string;
};

type NumstatEntry = {
  path: string;
  added: number;
  deleted: number;
};

export function parseGitStatus(raw: string): StatusEntry[] {
  if (!raw) return [];

  const lines = raw.split("\n").filter((line) => line.length > 0);
  const entries: StatusEntry[] = [];

  for (const line of lines) {
    const indexStatus = line[0];
    const workTreeStatus = line[1];

    // Filter out ignored files
    if (indexStatus === "!" && workTreeStatus === "!") continue;

    // Rest of line after "XY " (position 3 onward)
    let path = line.slice(3);

    // Handle renames: "R  old-name.ts -> new-name.ts" — use destination
    if (indexStatus === "R" || workTreeStatus === "R") {
      const arrowIndex = path.indexOf(" -> ");
      if (arrowIndex !== -1) {
        path = path.slice(arrowIndex + 4);
      }
    }

    entries.push({ path, indexStatus, workTreeStatus });
  }

  return entries;
}

export function parseNumstat(raw: string): NumstatEntry[] {
  if (!raw) return [];

  const lines = raw.split("\n").filter((line) => line.length > 0);
  const entries: NumstatEntry[] = [];

  for (const line of lines) {
    const [addedStr, deletedStr, ...pathParts] = line.split("\t");
    const path = pathParts.join("\t");
    const added = addedStr === "-" ? 0 : Number(addedStr);
    const deleted = deletedStr === "-" ? 0 : Number(deletedStr);
    entries.push({ path, added, deleted });
  }

  return entries;
}

export function mergeGitData(
  statusEntries: StatusEntry[],
  stagedNumstat: NumstatEntry[],
  unstagedNumstat: NumstatEntry[],
): GitFileEntry[] {
  const stagedMap = new Map<string, NumstatEntry>();
  for (const entry of stagedNumstat) {
    stagedMap.set(entry.path, entry);
  }

  const unstagedMap = new Map<string, NumstatEntry>();
  for (const entry of unstagedNumstat) {
    unstagedMap.set(entry.path, entry);
  }

  return statusEntries.map((status) => {
    const staged = stagedMap.get(status.path);
    const unstaged = unstagedMap.get(status.path);
    const linesAdded = (staged?.added ?? 0) + (unstaged?.added ?? 0);
    const linesDeleted = (staged?.deleted ?? 0) + (unstaged?.deleted ?? 0);

    return {
      path: status.path,
      indexStatus: status.indexStatus as GitFileStatus,
      workTreeStatus: status.workTreeStatus as GitFileStatus,
      linesAdded,
      linesDeleted,
    };
  });
}

// --- Poller ---

type GitStatusPollerOptions = {
  cwd: string;
  intervalMs: number;
  onUpdate: (files: GitFileEntry[]) => void;
};

async function readProcessOutput(proc: { exited: Promise<number>; stdout: ReadableStream<Uint8Array> | null; stderr: ReadableStream<Uint8Array> | null }): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    proc.stdout ? new Response(proc.stdout).text() : Promise.resolve(""),
    proc.stderr ? new Response(proc.stderr).text() : Promise.resolve(""),
  ]);
  return { exitCode, stdout, stderr };
}

async function pollOnce(cwd: string): Promise<GitFileEntry[] | null> {
  try {
    const [statusResult, stagedResult, unstagedResult] = await Promise.all([
      readProcessOutput(Bun.spawn(["git", "status", "--porcelain=v1"], { cwd, stdout: "pipe", stderr: "pipe" })),
      readProcessOutput(Bun.spawn(["git", "diff", "--cached", "--numstat"], { cwd, stdout: "pipe", stderr: "pipe" })),
      readProcessOutput(Bun.spawn(["git", "diff", "--numstat"], { cwd, stdout: "pipe", stderr: "pipe" })),
    ]);

    // Check for git failures
    if (statusResult.exitCode !== 0) {
      console.warn("[git-status-poller] git status failed:", statusResult.stderr.trim());
      return null;
    }
    if (stagedResult.exitCode !== 0) {
      console.warn("[git-status-poller] git diff --cached --numstat failed:", stagedResult.stderr.trim());
      return null;
    }
    if (unstagedResult.exitCode !== 0) {
      console.warn("[git-status-poller] git diff --numstat failed:", unstagedResult.stderr.trim());
      return null;
    }

    const statusEntries = parseGitStatus(statusResult.stdout);
    const stagedNumstat = parseNumstat(stagedResult.stdout);
    const unstagedNumstat = parseNumstat(unstagedResult.stdout);

    return mergeGitData(statusEntries, stagedNumstat, unstagedNumstat);
  } catch (err) {
    console.warn("[git-status-poller] poll error:", err);
    return null;
  }
}

export function startGitStatusPoller(options: GitStatusPollerOptions): { stop: () => void } {
  let previousJson = "";

  const tick = async () => {
    const files = await pollOnce(options.cwd);
    if (files === null) return; // git failed, skip

    const json = JSON.stringify(files);
    if (json !== previousJson) {
      previousJson = json;
      options.onUpdate(files);
    }
  };

  // Run immediately, then on interval
  tick();
  const timer = setInterval(tick, options.intervalMs);

  return {
    stop: () => clearInterval(timer),
  };
}
