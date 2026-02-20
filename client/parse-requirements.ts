import type { UseCase } from "./types.ts";

const BLOCK_PATTERN = /```conclave:requirements\n([\s\S]*?)```/g;

export function parseRequirements(markdown: string): UseCase[] {
  const results: UseCase[] = [];

  for (const match of markdown.matchAll(BLOCK_PATTERN)) {
    try {
      const parsed = JSON.parse(match[1]);
      if (Array.isArray(parsed)) {
        results.push(...parsed);
      }
    } catch {
      // malformed JSON — skip this block
    }
  }

  return results;
}
