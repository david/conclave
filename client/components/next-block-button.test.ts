import { describe, test, expect, mock } from "bun:test";
import { parseNextBlock } from "./next-block-button.tsx";
import type { NextBlockClickPayload } from "./next-block-button.tsx";

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
  test("calls onRun with correct payload on click", () => {
    // Import NextBlockButton and invoke as function to get VNode
    const { NextBlockButton } = require("./next-block-button.tsx");
    const onRun = mock(() => {});
    const vnode = NextBlockButton({
      label: "Continue",
      command: "run next",
      metaContext: "wf-1",
      onRun,
      disabled: false,
    });

    // Simulate click by calling onClick handler
    vnode.props.onClick();
    expect(onRun).toHaveBeenCalledTimes(1);
    expect(onRun).toHaveBeenCalledWith({
      label: "Continue",
      command: "run next",
      metaContext: "wf-1",
    } satisfies NextBlockClickPayload);
  });

  test("does not call onRun when disabled", () => {
    const { NextBlockButton } = require("./next-block-button.tsx");
    const onRun = mock(() => {});
    const vnode = NextBlockButton({
      label: "Continue",
      command: "run next",
      metaContext: "wf-1",
      onRun,
      disabled: true,
    });

    // Simulate click
    vnode.props.onClick();
    expect(onRun).not.toHaveBeenCalled();
  });

  test("renders label as button text", () => {
    const { NextBlockButton } = require("./next-block-button.tsx");
    const vnode = NextBlockButton({
      label: "Run Phase 2",
      command: "phase2",
      metaContext: "wf",
      onRun: () => {},
    });

    expect(vnode.props.children).toBe("Run Phase 2");
  });

  test("applies disabled class when disabled", () => {
    const { NextBlockButton } = require("./next-block-button.tsx");
    const vnode = NextBlockButton({
      label: "Go",
      command: "go",
      metaContext: "wf",
      onRun: () => {},
      disabled: true,
    });

    expect(vnode.props.className).toContain("next-block-btn--disabled");
  });

  test("does not apply disabled class when not disabled", () => {
    const { NextBlockButton } = require("./next-block-button.tsx");
    const vnode = NextBlockButton({
      label: "Go",
      command: "go",
      metaContext: "wf",
      onRun: () => {},
      disabled: false,
    });

    expect(vnode.props.className).not.toContain("next-block-btn--disabled");
  });
});
