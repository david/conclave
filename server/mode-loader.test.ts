import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { loadModes, buildModeSystemPrompt } from "./mode-loader.ts";
import type { ModeDefinition } from "./mode-loader.ts";

const TMP_DIR = join(import.meta.dir, ".test-modes-tmp");
const PROJECT_DIR = join(TMP_DIR, "project");
const PROJECT_MODES = join(PROJECT_DIR, ".conclave", "modes");

// We don't touch the real ~/.conclave/modes/ — tests use a project dir only.

beforeEach(() => {
  mkdirSync(PROJECT_MODES, { recursive: true });
});

afterEach(() => {
  rmSync(TMP_DIR, { recursive: true, force: true });
});

describe("loadModes", () => {
  test("returns built-in chat mode when no mode files exist", () => {
    const modes = loadModes(PROJECT_DIR);
    expect(modes).toHaveLength(1);
    expect(modes[0].id).toBe("chat");
    expect(modes[0].label).toBe("Chat");
    expect(modes[0].color).toBe("neutral");
    expect(modes[0].instruction).toBe("");
  });

  test("parses a mode file with frontmatter", () => {
    writeFileSync(
      join(PROJECT_MODES, "research.md"),
      `---
label: Research
color: blue
icon: search
placeholder: Ask a question...
order: 1
---

Focus on understanding requirements.
Do NOT write code.`,
    );

    const modes = loadModes(PROJECT_DIR);
    expect(modes).toHaveLength(2);

    const research = modes.find((m) => m.id === "research")!;
    expect(research).toBeDefined();
    expect(research.label).toBe("Research");
    expect(research.color).toBe("blue");
    expect(research.icon).toBe("search");
    expect(research.placeholder).toBe("Ask a question...");
    expect(research.order).toBe(1);
    expect(research.instruction).toBe("Focus on understanding requirements.\nDo NOT write code.");
  });

  test("sorts modes by order then label", () => {
    writeFileSync(
      join(PROJECT_MODES, "implement.md"),
      `---
label: Implement
order: 3
---

Write code.`,
    );
    writeFileSync(
      join(PROJECT_MODES, "design.md"),
      `---
label: Design
order: 2
---

Design the solution.`,
    );
    writeFileSync(
      join(PROJECT_MODES, "research.md"),
      `---
label: Research
order: 1
---

Research first.`,
    );

    const modes = loadModes(PROJECT_DIR);
    expect(modes.map((m) => m.id)).toEqual(["chat", "research", "design", "implement"]);
  });

  test("chat mode file overrides built-in defaults", () => {
    writeFileSync(
      join(PROJECT_MODES, "chat.md"),
      `---
label: General
color: amber
icon: chat
placeholder: What's on your mind?
order: 0
---

Be helpful and concise.`,
    );

    const modes = loadModes(PROJECT_DIR);
    const chat = modes.find((m) => m.id === "chat")!;
    expect(chat.label).toBe("General");
    expect(chat.color).toBe("amber");
    expect(chat.placeholder).toBe("What's on your mind?");
    expect(chat.instruction).toBe("Be helpful and concise.");
  });

  test("handles files without frontmatter", () => {
    writeFileSync(
      join(PROJECT_MODES, "freeform.md"),
      "Just some instructions, no frontmatter.",
    );

    const modes = loadModes(PROJECT_DIR);
    const freeform = modes.find((m) => m.id === "freeform")!;
    expect(freeform).toBeDefined();
    expect(freeform.label).toBe("freeform");
    expect(freeform.color).toBe("neutral");
    expect(freeform.order).toBe(99);
    expect(freeform.instruction).toBe("Just some instructions, no frontmatter.");
  });

  test("ignores non-.md files", () => {
    writeFileSync(join(PROJECT_MODES, "notes.txt"), "ignore me");
    writeFileSync(join(PROJECT_MODES, "config.json"), "{}");

    const modes = loadModes(PROJECT_DIR);
    expect(modes).toHaveLength(1);
    expect(modes[0].id).toBe("chat");
  });

  test("handles missing .conclave/modes/ directory gracefully", () => {
    rmSync(PROJECT_MODES, { recursive: true, force: true });
    const modes = loadModes(PROJECT_DIR);
    expect(modes).toHaveLength(1);
    expect(modes[0].id).toBe("chat");
  });
});

describe("skills", () => {
  test("parses comma-separated skills from frontmatter", () => {
    // Create skill files
    const skillsDir = join(PROJECT_DIR, ".conclave", "skills");
    mkdirSync(skillsDir, { recursive: true });
    writeFileSync(join(skillsDir, "analyze.md"), "Analyze the requirements carefully.");
    writeFileSync(join(skillsDir, "format.md"), "Output in structured format.");

    writeFileSync(
      join(PROJECT_MODES, "research.md"),
      `---
label: Research
skills: .conclave/skills/analyze.md, .conclave/skills/format.md
order: 1
---

Research instructions.`,
    );

    const modes = loadModes(PROJECT_DIR);
    const research = modes.find((m) => m.id === "research")!;
    expect(research.skills).toEqual([
      ".conclave/skills/analyze.md",
      ".conclave/skills/format.md",
    ]);
    expect(research.resolvedSkills).toHaveLength(2);
    expect(research.resolvedSkills[0]).toBe("Analyze the requirements carefully.");
    expect(research.resolvedSkills[1]).toBe("Output in structured format.");
  });

  test("skips missing skill files silently", () => {
    writeFileSync(
      join(PROJECT_MODES, "test.md"),
      `---
label: Test
skills: nonexistent/skill.md
order: 1
---

Test mode.`,
    );

    const modes = loadModes(PROJECT_DIR);
    const test_ = modes.find((m) => m.id === "test")!;
    expect(test_.skills).toEqual(["nonexistent/skill.md"]);
    expect(test_.resolvedSkills).toHaveLength(0);
  });

  test("mode without skills has empty arrays", () => {
    writeFileSync(
      join(PROJECT_MODES, "plain.md"),
      `---
label: Plain
order: 1
---

No skills here.`,
    );

    const modes = loadModes(PROJECT_DIR);
    const plain = modes.find((m) => m.id === "plain")!;
    expect(plain.skills).toEqual([]);
    expect(plain.resolvedSkills).toEqual([]);
  });
});

describe("buildModeSystemPrompt", () => {
  test("returns empty string when no modes have instructions", () => {
    const modes: ModeDefinition[] = [
      { id: "chat", label: "Chat", color: "neutral", icon: "chat", placeholder: "", order: 0, instruction: "", skills: [], resolvedSkills: [] },
    ];
    expect(buildModeSystemPrompt(modes)).toBe("");
  });

  test("includes modes with instructions", () => {
    const modes: ModeDefinition[] = [
      { id: "chat", label: "Chat", color: "neutral", icon: "chat", placeholder: "", order: 0, instruction: "", skills: [], resolvedSkills: [] },
      { id: "research", label: "Research", color: "blue", icon: "search", placeholder: "", order: 1, instruction: "Focus on research.\nNo code.", skills: [], resolvedSkills: [] },
    ];
    const prompt = buildModeSystemPrompt(modes);
    expect(prompt).toContain("multi-mode workflow");
    expect(prompt).toContain("[Mode: Research]");
    expect(prompt).toContain("Focus on research.");
  });
});
