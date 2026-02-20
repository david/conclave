import { describe, test, expect } from "bun:test";
import { parseRequirements } from "./parse-requirements.ts";
import type { UseCase } from "./types.ts";

const uc1: UseCase = {
  id: "UC-1",
  name: "Login with email/password",
  actor: "End User",
  summary: "User authenticates using credentials",
  given: ["User has a registered account", "User is on the login page"],
  when: ["User enters valid credentials", "User clicks submit"],
  then: ["User session is created", "User is redirected to dashboard"],
  priority: "high",
};

const uc2: UseCase = {
  id: "UC-2",
  name: "Reset password",
  actor: "End User",
  summary: "User resets a forgotten password",
  given: ["User has a registered account"],
  when: ["User clicks forgot password", "User enters email", "User submits"],
  then: ["Reset email is sent"],
  priority: "medium",
  dependencies: ["UC-1"],
};

/** One fenced block per use case (new format) */
function makeBlock(uc: UseCase): string {
  return "```conclave:requirements\n" + JSON.stringify(uc, null, 2) + "\n```";
}

describe("parseRequirements", () => {
  test("extracts a single use case from a tagged code block", () => {
    const markdown = "Here is the analysis:\n\n" + makeBlock(uc1) + "\n\nThat's all.";
    expect(parseRequirements(markdown)).toEqual([uc1]);
  });

  test("extracts multiple use cases from separate blocks", () => {
    const markdown = makeBlock(uc1) + "\n\n" + makeBlock(uc2);
    expect(parseRequirements(markdown)).toEqual([uc1, uc2]);
  });

  test("returns empty array when no tagged block exists", () => {
    const markdown = "Just some regular markdown text.\n\n```js\nconsole.log('hi')\n```";
    expect(parseRequirements(markdown)).toEqual([]);
  });

  test("returns empty array for empty string", () => {
    expect(parseRequirements("")).toEqual([]);
  });

  test("handles multiple tagged blocks with prose between them", () => {
    const markdown = makeBlock(uc1) + "\n\nMore analysis:\n\n" + makeBlock(uc2);
    expect(parseRequirements(markdown)).toEqual([uc1, uc2]);
  });

  test("returns empty array for malformed JSON inside block", () => {
    const markdown = "```conclave:requirements\n{ not valid json ]\n```";
    expect(parseRequirements(markdown)).toEqual([]);
  });

  test("backward compat: accepts JSON array inside a single block", () => {
    const markdown =
      "```conclave:requirements\n" + JSON.stringify([uc1, uc2], null, 2) + "\n```";
    expect(parseRequirements(markdown)).toEqual([uc1, uc2]);
  });

  test("does not match similar but wrong tags", () => {
    const markdown = "```requirements\n" + JSON.stringify(uc1) + "\n```";
    expect(parseRequirements(markdown)).toEqual([]);
  });

  test("handles use cases with and without dependencies", () => {
    const markdown = makeBlock(uc1) + "\n\n" + makeBlock(uc2);
    const result = parseRequirements(markdown);
    expect(result[0].dependencies).toBeUndefined();
    expect(result[1].dependencies).toEqual(["UC-1"]);
  });

  // Deduplication tests
  test("keeps only the latest version when a use case id appears multiple times", () => {
    const uc1v2: UseCase = {
      ...uc1,
      summary: "Updated summary for v2",
      given: ["Revised precondition"],
      when: ["Revised action"],
      then: ["Revised outcome"],
    };
    const markdown = makeBlock(uc1) + "\n\nRevised:\n\n" + makeBlock(uc1v2);
    const result = parseRequirements(markdown);
    expect(result).toHaveLength(1);
    expect(result[0].summary).toBe("Updated summary for v2");
  });

  test("preserves order of first appearance when deduplicating", () => {
    const uc1v2: UseCase = { ...uc1, summary: "Updated UC-1" };
    const markdown = makeBlock(uc1) + "\n\n" + makeBlock(uc2) + "\n\n" + makeBlock(uc1v2);
    const result = parseRequirements(markdown);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("UC-1");
    expect(result[0].summary).toBe("Updated UC-1");
    expect(result[1].id).toBe("UC-2");
  });

  // Streaming-specific tests
  test("open block (no closing fence) with complete JSON extracts it", () => {
    const markdown = "```conclave:requirements\n" + JSON.stringify(uc1, null, 2);
    expect(parseRequirements(markdown)).toEqual([uc1]);
  });

  test("open block with incomplete JSON returns empty", () => {
    const markdown = '```conclave:requirements\n{ "id": "UC-1", "name": "Incompl';
    expect(parseRequirements(markdown)).toEqual([]);
  });

  test("mix of closed blocks and trailing open block merges all", () => {
    const markdown =
      makeBlock(uc1) +
      "\n\nSome explanation.\n\n" +
      "```conclave:requirements\n" +
      JSON.stringify(uc2, null, 2);
    expect(parseRequirements(markdown)).toEqual([uc1, uc2]);
  });
});
