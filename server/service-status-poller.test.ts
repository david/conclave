import { describe, test, expect } from "bun:test";
import { parseProcesses } from "./service-status-poller.ts";

describe("parseProcesses", () => {
  test("with valid data returns correctly shaped ServiceProcess[]", () => {
    const input = {
      data: [
        { name: "server", status: "Running", uptime: "1h2m", extra: "ignored" },
        { name: "build", status: "Completed", uptime: "5m" },
      ],
    };
    const result = parseProcesses(input);
    expect(result).toEqual([
      { name: "server", status: "Running", uptime: "1h2m" },
      { name: "build", status: "Completed", uptime: "5m" },
    ]);
  });

  test("with empty data array returns []", () => {
    expect(parseProcesses({ data: [] })).toEqual([]);
  });

  test("with null returns []", () => {
    expect(parseProcesses(null)).toEqual([]);
  });

  test("with missing data key returns []", () => {
    expect(parseProcesses({ other: "stuff" })).toEqual([]);
  });

  test("with non-array data returns []", () => {
    expect(parseProcesses({ data: "not-array" })).toEqual([]);
  });

  test("with undefined returns []", () => {
    expect(parseProcesses(undefined)).toEqual([]);
  });
});
