import { join } from "path";
import { readdirSync, readFileSync, existsSync } from "fs";
import { homedir } from "os";

export type ModeDefinition = {
  id: string;
  label: string;
  color: string;
  icon: string;
  placeholder: string;
  order: number;
  instruction: string;
  skills: string[];
  resolvedSkills: string[];
};

/** Built-in chat mode — always present, no file required. */
const CHAT_MODE: ModeDefinition = {
  id: "chat",
  label: "Chat",
  color: "neutral",
  icon: "chat",
  placeholder: "Type a message...",
  order: 0,
  instruction: "",
  skills: [],
  resolvedSkills: [],
};

type FrontmatterData = Record<string, string>;

/** Parse YAML-like frontmatter from a markdown file. Supports simple key: value pairs only. */
function parseFrontmatter(content: string): { data: FrontmatterData; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return { data: {}, body: content.trim() };
  }

  const data: FrontmatterData = {};
  for (const line of match[1].split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    if (key) data[key] = value;
  }

  return { data, body: match[2].trim() };
}

/** Read all .md files from a directory and parse them as mode definitions. */
function readModesFromDir(dir: string): Map<string, ModeDefinition> {
  const modes = new Map<string, ModeDefinition>();

  if (!existsSync(dir)) return modes;

  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return modes;
  }

  for (const entry of entries) {
    if (!entry.endsWith(".md")) continue;

    const id = entry.slice(0, -3); // strip .md
    const filePath = join(dir, entry);

    try {
      const content = readFileSync(filePath, "utf8");
      const { data, body } = parseFrontmatter(content);

      const skills = data.skills
        ? data.skills.split(",").map((s) => s.trim()).filter(Boolean)
        : [];

      modes.set(id, {
        id,
        label: data.label || id,
        color: data.color || "neutral",
        icon: data.icon || "mode",
        placeholder: data.placeholder || "Type a message...",
        order: data.order ? parseInt(data.order, 10) : 99,
        instruction: body,
        skills,
        resolvedSkills: [],
      });
    } catch {
      // Skip unreadable files
    }
  }

  return modes;
}

/**
 * Resolve skill paths to their file contents.
 * Paths are resolved relative to cwd. Unreadable files are silently skipped.
 */
function resolveSkills(skills: string[], cwd: string): string[] {
  const resolved: string[] = [];
  for (const skillPath of skills) {
    const fullPath = join(cwd, skillPath);
    try {
      if (existsSync(fullPath)) {
        resolved.push(readFileSync(fullPath, "utf8").trim());
      }
    } catch {
      // Skip unreadable skill files
    }
  }
  return resolved;
}

/**
 * Load modes from global (~/.conclave/modes/) and project (.conclave/modes/) directories.
 * Project modes override global by filename. Chat mode is always included.
 * Skill paths are resolved relative to cwd.
 */
export function loadModes(cwd: string): ModeDefinition[] {
  const globalDir = join(homedir(), ".conclave", "modes");
  const projectDir = join(cwd, ".conclave", "modes");

  // Start with global modes
  const modes = readModesFromDir(globalDir);

  // Project modes override global
  const projectModes = readModesFromDir(projectDir);
  for (const [id, mode] of projectModes) {
    modes.set(id, mode);
  }

  // Ensure chat mode is always present (can be overridden by file)
  if (!modes.has("chat")) {
    modes.set("chat", CHAT_MODE);
  }

  // Resolve skill files for each mode
  for (const mode of modes.values()) {
    if (mode.skills.length > 0) {
      mode.resolvedSkills = resolveSkills(mode.skills, cwd);
    }
  }

  // Sort by order, then by label
  return Array.from(modes.values()).sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.label.localeCompare(b.label);
  });
}

/**
 * Build the system prompt append text that teaches the agent about the multi-mode workflow.
 */
export function buildModeSystemPrompt(modes: ModeDefinition[]): string {
  const modesWithInstructions = modes.filter((m) => m.instruction);
  if (modesWithInstructions.length === 0) return "";

  const modeDescriptions = modesWithInstructions
    .map((m) => `- [Mode: ${m.label}]: ${m.instruction.split("\n")[0]}`)
    .join("\n");

  return [
    "You are operating in a multi-mode workflow controlled by the user.",
    "Each prompt may begin with a [Mode: ...] directive indicating behavioral constraints.",
    "Follow the instructions for the indicated mode strictly.",
    "",
    "Available modes:",
    modeDescriptions,
  ].join("\n");
}
