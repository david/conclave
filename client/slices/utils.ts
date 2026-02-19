import type { FileChangeAction } from "../types.ts";

export function extractFilePath(input: unknown): string | null {
  if (!input || typeof input !== "object") return null;
  const obj = input as Record<string, unknown>;
  const p = obj.file_path ?? obj.path;
  return typeof p === "string" ? p : null;
}

export function kindToAction(kind: string | null | undefined): FileChangeAction | null {
  if (kind === "edit") return "modified";
  if (kind === "delete") return "deleted";
  return null;
}
