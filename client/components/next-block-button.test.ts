import { describe, test, expect } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseNextBlock, NextBlockButton } from "./next-block-button.tsx";

describe("parseNextBlock", () => {
  test("returns valid result with all fields present", () => {
    const json = JSON.stringify({
      label: "Run Analysis",
      command: "run analysis phase",
      metaContext: "my-workflow",
    });
    const result = parseNextBlock(json);
    expect(result).toEqual({
      valid: true,
      label: "Run Analysis",
      command: "run analysis phase",
      metaContext: "my-workflow",
    });
  });

  test("returns valid result without metaContext when field is missing", () => {
    const json = JSON.stringify({
      label: "Next Step",
      command: "do next thing",
    });
    const result = parseNextBlock(json);
    expect(result).toEqual({
      valid: true,
      label: "Next Step",
      command: "do next thing",
      metaContext: undefined,
    });
  });

  test("returns valid result without metaContext when field is empty string", () => {
    const json = JSON.stringify({
      label: "Next Step",
      command: "do next thing",
      metaContext: "",
    });
    const result = parseNextBlock(json);
    expect(result).toEqual({
      valid: true,
      label: "Next Step",
      command: "do next thing",
      metaContext: undefined,
    });
  });

  test("returns invalid for non-string label", () => {
    const json = JSON.stringify({ label: 42, command: "go" });
    const result = parseNextBlock(json);
    expect(result).toEqual({ valid: false });
  });

  test("returns invalid for non-string command", () => {
    const json = JSON.stringify({ label: "Go", command: 99 });
    const result = parseNextBlock(json);
    expect(result).toEqual({ valid: false });
  });

  test("returns invalid for missing label", () => {
    const json = JSON.stringify({ command: "go" });
    const result = parseNextBlock(json);
    expect(result).toEqual({ valid: false });
  });

  test("returns invalid for missing command", () => {
    const json = JSON.stringify({ label: "Go" });
    const result = parseNextBlock(json);
    expect(result).toEqual({ valid: false });
  });

  test("returns invalid for invalid JSON", () => {
    const result = parseNextBlock("not json {{{");
    expect(result).toEqual({ valid: false });
  });

  test("returns invalid for JSON array", () => {
    const result = parseNextBlock("[1, 2]");
    expect(result).toEqual({ valid: false });
  });

  test("returns invalid for JSON null", () => {
    const result = parseNextBlock("null");
    expect(result).toEqual({ valid: false });
  });

  test("returns invalid for JSON primitive", () => {
    const result = parseNextBlock('"hello"');
    expect(result).toEqual({ valid: false });
  });
});

describe("NextBlockButton", () => {
  test("renders label as button text", () => {
    const html = renderToStaticMarkup(
      React.createElement(NextBlockButton, {
        label: "Run Phase 2",
        command: "phase2",
        metaContext: "wf",
        onRun: () => {},
      }),
    );
    expect(html).toContain("Run Phase 2");
  });

  test("renders enabled button when disabled is false", () => {
    const html = renderToStaticMarkup(
      React.createElement(NextBlockButton, {
        label: "Go",
        command: "go",
        metaContext: "wf",
        onRun: () => {},
        disabled: false,
      }),
    );
    expect(html).not.toContain("next-block-btn--disabled");
    expect(html).not.toContain("disabled");
  });

  test("renders disabled button when disabled prop is true", () => {
    const html = renderToStaticMarkup(
      React.createElement(NextBlockButton, {
        label: "Go",
        command: "go",
        metaContext: "wf",
        onRun: () => {},
        disabled: true,
      }),
    );
    expect(html).toContain("next-block-btn--disabled");
    expect(html).toContain("disabled");
  });

  test("initial render is enabled when clicked state is false", () => {
    // Verifies that the internal clicked state starts as false,
    // so a button with disabled=false renders without the disabled attribute
    const html = renderToStaticMarkup(
      React.createElement(NextBlockButton, {
        label: "Run",
        command: "run",
        metaContext: "wf",
        onRun: () => {},
        disabled: false,
      }),
    );
    expect(html).toContain("<button");
    expect(html).not.toContain("disabled");
  });
});
