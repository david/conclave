import { unified } from "unified";
import remarkParse from "remark-parse";
import type { UseCase } from "./types.ts";

const parser = unified().use(remarkParse);

export function parseRequirements(markdown: string): UseCase[] {
  const tree = parser.parse(markdown);
  const results: UseCase[] = [];

  for (const node of tree.children) {
    if (node.type !== "code" || node.lang !== "conclave:requirements") continue;
    try {
      const parsed = JSON.parse(node.value);
      if (Array.isArray(parsed)) {
        results.push(...parsed);
      } else if (parsed && typeof parsed === "object") {
        results.push(parsed);
      }
    } catch {
      // incomplete or malformed JSON — skip
    }
  }

  // Deduplicate by id, keeping the last (most recent) version
  const byId = new Map<string, UseCase>();
  for (const uc of results) {
    byId.set(uc.id, uc);
  }
  return Array.from(byId.values());
}
