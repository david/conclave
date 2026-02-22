import { describe, test, expect } from "bun:test";
import { buildGroupedOptions, resolveSelection, sessionLabel } from "./session-picker.tsx";
import type { SessionInfo } from "../types.ts";
import type { MetaContextInfo } from "../types.ts";

const sessions: SessionInfo[] = [
  { sessionId: "s1", name: "Session 1", title: "My Feature", firstPrompt: null },
  { sessionId: "s2", name: "Session 2", title: null, firstPrompt: "hello world" },
  { sessionId: "s3", name: "Session 3", title: null, firstPrompt: null },
  { sessionId: "s4", name: "Session 4", title: "Standalone", firstPrompt: null },
];

const metaContexts: MetaContextInfo[] = [
  { id: "mc1", name: "Feature A", sessionIds: ["s1", "s2"] },
  { id: "mc2", name: "Feature B", sessionIds: ["s3"] },
];

describe("sessionLabel", () => {
  test("uses title when available", () => {
    expect(sessionLabel({ sessionId: "s1", name: "Session 1", title: "My Title", firstPrompt: "prompt" }))
      .toBe("My Title");
  });

  test("falls back to firstPrompt when no title", () => {
    expect(sessionLabel({ sessionId: "s2", name: "Session 2", title: null, firstPrompt: "hello world" }))
      .toBe("hello world");
  });

  test("falls back to name when no title or firstPrompt", () => {
    expect(sessionLabel({ sessionId: "s3", name: "Session 3", title: null, firstPrompt: null }))
      .toBe("Session 3");
  });

  test("truncates long titles to 60 chars", () => {
    const longTitle = "A".repeat(80);
    const result = sessionLabel({ sessionId: "s1", name: "S1", title: longTitle, firstPrompt: null });
    expect(result.length).toBe(63); // 60 + "..."
    expect(result.endsWith("...")).toBe(true);
  });

  test("takes only first line of multi-line text", () => {
    expect(sessionLabel({ sessionId: "s1", name: "S1", title: "Line 1\nLine 2\nLine 3", firstPrompt: null }))
      .toBe("Line 1");
  });
});

describe("buildGroupedOptions", () => {
  test("groups meta-context sessions under Specs and standalone under Sessions", () => {
    const groups = buildGroupedOptions(sessions, metaContexts);

    expect(groups).toHaveLength(2);
    expect(groups[0].label).toBe("Specs");
    expect(groups[1].label).toBe("Sessions");
  });

  test("meta-context options use mc: prefix and meta-context name as label", () => {
    const groups = buildGroupedOptions(sessions, metaContexts);
    const specOptions = groups[0].options;

    expect(specOptions).toHaveLength(2);
    expect(specOptions[0]).toEqual({ value: "mc:mc1", label: "Feature A" });
    expect(specOptions[1]).toEqual({ value: "mc:mc2", label: "Feature B" });
  });

  test("standalone sessions exclude those belonging to a meta-context", () => {
    const groups = buildGroupedOptions(sessions, metaContexts);
    const sessionOptions = groups[1].options;

    // Only s4 is standalone; s1, s2, s3 belong to meta-contexts
    expect(sessionOptions).toHaveLength(1);
    expect(sessionOptions[0].value).toBe("s4");
    expect(sessionOptions[0].label).toBe("Standalone");
  });

  test("omits Specs group when no meta-contexts exist", () => {
    const groups = buildGroupedOptions(sessions, []);

    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Sessions");
    expect(groups[0].options).toHaveLength(4);
  });

  test("returns empty Sessions group when all sessions are in meta-contexts", () => {
    const allInMC: MetaContextInfo[] = [
      { id: "mc1", name: "Feature A", sessionIds: ["s1", "s2", "s3", "s4"] },
    ];
    const groups = buildGroupedOptions(sessions, allInMC);

    expect(groups).toHaveLength(2);
    expect(groups[0].label).toBe("Specs");
    expect(groups[0].options).toHaveLength(1);
    expect(groups[1].label).toBe("Sessions");
    expect(groups[1].options).toHaveLength(0);
  });
});

describe("resolveSelection", () => {
  test("resolves mc: prefixed value to last session in meta-context", () => {
    const result = resolveSelection("mc:mc1", metaContexts);
    expect(result).toBe("s2"); // last in ["s1", "s2"]
  });

  test("resolves mc: for single-session meta-context", () => {
    const result = resolveSelection("mc:mc2", metaContexts);
    expect(result).toBe("s3"); // only session in mc2
  });

  test("returns null for unknown mc: id", () => {
    const result = resolveSelection("mc:unknown", metaContexts);
    expect(result).toBeNull();
  });

  test("returns null for mc: with empty sessionIds", () => {
    const emptyMC: MetaContextInfo[] = [{ id: "mc1", name: "Empty", sessionIds: [] }];
    const result = resolveSelection("mc:mc1", emptyMC);
    expect(result).toBeNull();
  });

  test("returns raw value for non-mc: prefixed selection", () => {
    const result = resolveSelection("s4", metaContexts);
    expect(result).toBe("s4");
  });

  test("returns raw value when metaContexts is empty", () => {
    const result = resolveSelection("s1", []);
    expect(result).toBe("s1");
  });
});

describe("currentValue resolution", () => {
  // This tests the logic that determines what the picker shows as selected
  // when the current session belongs to a meta-context

  test("resolves to meta-context option when session is in a meta-context", () => {
    // s1 belongs to mc1 "Feature A"
    const groups = buildGroupedOptions(sessions, metaContexts);
    const mc = metaContexts.find((m) => m.sessionIds.includes("s1"));
    expect(mc).toBeDefined();
    expect(mc!.id).toBe("mc1");
    expect(mc!.name).toBe("Feature A");
    // The picker should show { value: "mc:mc1", label: "Feature A" }
    const specOptions = groups[0].options;
    const matchingOption = specOptions.find((o) => o.value === `mc:${mc!.id}`);
    expect(matchingOption).toEqual({ value: "mc:mc1", label: "Feature A" });
  });

  test("resolves to session option when session is standalone", () => {
    // s4 is standalone
    const mc = metaContexts.find((m) => m.sessionIds.includes("s4"));
    expect(mc).toBeUndefined();
    const groups = buildGroupedOptions(sessions, metaContexts);
    const sessionOptions = groups[1].options;
    const matchingOption = sessionOptions.find((o) => o.value === "s4");
    expect(matchingOption).toEqual({ value: "s4", label: "Standalone" });
  });
});
