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

    // Determine phase: implementation.md wins over analysis.md
    let phase: SpecInfo["phase"] = null;
    const hasImpl = await Bun.file(join(dir, "implementation.md")).exists();
    const hasAnalysis = await Bun.file(join(dir, "analysis.md")).exists();

    if (hasImpl) {
      phase = "implementation";
    } else if (hasAnalysis) {
      phase = "analysis";
    }

    specs.push({ name, description, phase, type, epic });
  }

  return specs;
}
