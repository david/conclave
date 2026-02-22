import { readdir, stat } from "fs/promises";
import { join } from "path";
import type { SpecInfo } from "./types.ts";

export async function scanSpecs(baseDir: string): Promise<SpecInfo[]> {
  let entries: string[];
  try {
    entries = await readdir(baseDir);
  } catch {
    return [];
  }

  const specs: SpecInfo[] = [];

  for (const name of entries) {
    const dir = join(baseDir, name);
    const s = await stat(dir).catch(() => null);
    if (!s || !s.isDirectory()) continue;

    // Read spec.json if present
    let description: string | null = null;
    let type: "epic" | "spec" = "spec";
    let epic: string | null = null;

    try {
      const raw = await Bun.file(join(dir, "spec.json")).text();
      const json = JSON.parse(raw);
      description = json.description ?? null;
      type = json.type === "epic" ? "epic" : "spec";
      epic = json.epic ?? null;
    } catch {
      // No spec.json or invalid — use defaults
    }

    // Determine phase: later phase wins (implementation > analysis > research)
    let phase: SpecInfo["phase"] = null;
    const hasImpl = await Bun.file(join(dir, "implementation.md")).exists();
    const hasAnalysis = await Bun.file(join(dir, "analysis.md")).exists();
    const hasResearch = await Bun.file(join(dir, "research.md")).exists();

    if (hasImpl) {
      phase = "implementation";
    } else if (hasAnalysis) {
      phase = "analysis";
    } else if (hasResearch) {
      phase = "research";
    }

    specs.push({ name, description, phase, type, epic });
  }

  return specs;
}
