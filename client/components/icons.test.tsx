import { describe, test, expect } from "bun:test";
import { GitStatusIcon } from "./icons.tsx";

describe("GitStatusIcon", () => {
  test.each(["M", "A", "D", "R", "?"])("renders for status '%s'", (status) => {
    const result = GitStatusIcon({ status });
    expect(result).toBeTruthy();
  });

  test("renders default icon for unknown status", () => {
    const result = GitStatusIcon({ status: "X" });
    expect(result).toBeTruthy();
  });

  test("accepts optional size prop", () => {
    const result = GitStatusIcon({ status: "M", size: 20 });
    expect(result).toBeTruthy();
  });

  test("accepts optional className prop", () => {
    const result = GitStatusIcon({ status: "A", className: "custom" });
    expect(result).toBeTruthy();
  });
});
