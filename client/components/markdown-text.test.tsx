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
    expect(html).toContain("next-block__diamond");
    expect(html).not.toContain("next-block--disabled");
    expect(html).toContain('aria-disabled="false"');
  });

  test("next-block button is disabled when isReplay is true", () => {
    const html = renderToStaticMarkup(
      <MarkdownText text={nextBlockMarkdown} isReplay={true} />,
    );
    expect(html).toContain("next-block__diamond");
    expect(html).toContain("next-block--disabled");
    expect(html).toContain('aria-disabled="true"');
  });

  test("next-block button is enabled when isReplay is omitted", () => {
    const html = renderToStaticMarkup(
      <MarkdownText text={nextBlockMarkdown} />,
    );
    expect(html).toContain("next-block__diamond");
    expect(html).not.toContain("next-block--disabled");
  });
});

describe("MarkdownText heading normalization", () => {
  test("heading immediately after text on same line is rendered as a heading", () => {
    const html = renderToStaticMarkup(<MarkdownText text="Some text.### Heading" />);
    expect(html).toContain("<h3");
    expect(html).toContain("Heading");
  });

  test("heading with existing preceding newline is unchanged", () => {
    const html = renderToStaticMarkup(<MarkdownText text={"Some text.\n\n### Heading"} />);
    expect(html).toContain("<h3");
    expect(html).toContain("Heading");
  });

  test("heading at start of text is unchanged", () => {
    const html = renderToStaticMarkup(<MarkdownText text={"### Heading\n\nSome text."} />);
    expect(html).toContain("<h3");
    expect(html).toContain("Heading");
  });

  test("multiple heading levels without preceding newlines are all normalized", () => {
    const html = renderToStaticMarkup(<MarkdownText text="Text.## H2 more.### H3" />);
    expect(html).toContain("<h2");
    expect(html).toContain("<h3");
  });

  test("hash characters in non-heading context are not affected", () => {
    const html = renderToStaticMarkup(<MarkdownText text="Issue #123 is fixed" />);
    expect(html).not.toContain("<h1");
    expect(html).not.toContain("<h2");
    expect(html).not.toContain("<h3");
    expect(html).not.toContain("<h4");
    expect(html).not.toContain("<h5");
    expect(html).not.toContain("<h6");
  });
});
