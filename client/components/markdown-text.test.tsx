import { describe, test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { MarkdownText } from "./markdown-text.tsx";

describe("MarkdownText invalid block fallback", () => {
  test("invalid JSON in conclave:eventmodel block renders as a code block", () => {
    const markdown = "```conclave:eventmodel\n{not valid json}\n```";
    const html = renderToStaticMarkup(<MarkdownText text={markdown} />);

    // Should render as a normal code block (fallback)
    expect(html).toContain("code-block");
    // Should NOT render as a diagram
    expect(html).not.toContain("em-diagram");
  });

  test("valid JSON missing the slice field renders as a code block", () => {
    const markdown = '```conclave:eventmodel\n{"name": "test"}\n```';
    const html = renderToStaticMarkup(<MarkdownText text={markdown} />);

    // Should render as a normal code block (fallback)
    expect(html).toContain("code-block");
    // Should NOT render as a diagram
    expect(html).not.toContain("em-diagram");
  });

  test("one valid and one invalid block: valid is suppressed, invalid falls back to code block", () => {
    const validSlice = JSON.stringify({
      slice: "test-slice",
      events: [{ name: "TestEvent" }],
    });
    const markdown = [
      "```conclave:eventmodel",
      validSlice,
      "```",
      "",
      "```conclave:eventmodel",
      "{not valid json}",
      "```",
    ].join("\n");

    const html = renderToStaticMarkup(<MarkdownText text={markdown} />);

    // The valid block should be suppressed in the markdown and rendered as a diagram
    expect(html).toContain("em-diagram");
    expect(html).toContain("TestEvent");

    // The invalid block should fall back to a code block
    expect(html).toContain("code-block");
  });

  test("normal message with no eventmodel blocks renders normally", () => {
    const markdown = "Hello **world**, this is a paragraph.\n\n- Item one\n- Item two";
    const html = renderToStaticMarkup(<MarkdownText text={markdown} />);

    // Should render normal markdown content
    expect(html).toContain("Hello");
    expect(html).toContain("<strong>world</strong>");
    expect(html).toContain("Item one");
    expect(html).toContain("Item two");

    // Should NOT render a diagram
    expect(html).not.toContain("em-diagram");
  });

  test("empty string in slice field renders as a code block", () => {
    const markdown = '```conclave:eventmodel\n{"slice": ""}\n```';
    const html = renderToStaticMarkup(<MarkdownText text={markdown} />);

    // Empty slice string should be treated as invalid
    expect(html).toContain("code-block");
    expect(html).not.toContain("em-diagram");
  });

  test("non-string slice field renders as a code block", () => {
    const markdown = '```conclave:eventmodel\n{"slice": 123}\n```';
    const html = renderToStaticMarkup(<MarkdownText text={markdown} />);

    // Non-string slice should be treated as invalid
    expect(html).toContain("code-block");
    expect(html).not.toContain("em-diagram");
  });

  test("slice field set to null renders as a code block", () => {
    const markdown = '```conclave:eventmodel\n{"slice": null}\n```';
    const html = renderToStaticMarkup(<MarkdownText text={markdown} />);

    expect(html).toContain("code-block");
    expect(html).not.toContain("em-diagram");
  });

  test("completely empty conclave:eventmodel block renders as a code block", () => {
    const markdown = "```conclave:eventmodel\n\n```";
    const html = renderToStaticMarkup(<MarkdownText text={markdown} />);

    expect(html).toContain("code-block");
    expect(html).not.toContain("em-diagram");
  });
});

describe("MarkdownText isReplay prop", () => {
  const nextBlockJson = JSON.stringify({
    label: "Run Phase 2",
    command: "run phase2",
    metaContext: "workflow-1",
  });
  const nextBlockMarkdown = "```conclave:next\n" + nextBlockJson + "\n```";

  test("next-block button is enabled when isReplay is false", () => {
    const html = renderToStaticMarkup(
      <MarkdownText text={nextBlockMarkdown} isReplay={false} />,
    );
    // Button should be present and not disabled
    expect(html).toContain("next-block-btn");
    expect(html).not.toContain("next-block-btn--disabled");
    expect(html).not.toContain("disabled");
  });

  test("next-block button is disabled when isReplay is true", () => {
    const html = renderToStaticMarkup(
      <MarkdownText text={nextBlockMarkdown} isReplay={true} />,
    );
    // Button should be present and disabled
    expect(html).toContain("next-block-btn");
    expect(html).toContain("next-block-btn--disabled");
    expect(html).toContain("disabled");
  });

  test("next-block button is enabled when isReplay is omitted", () => {
    const html = renderToStaticMarkup(
      <MarkdownText text={nextBlockMarkdown} />,
    );
    // Default behavior: button should not be disabled
    expect(html).toContain("next-block-btn");
    expect(html).not.toContain("next-block-btn--disabled");
  });
});
