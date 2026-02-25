import { describe, test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import {
  normalizeMarkdown,
  extractText,
  CopyButton,
  baseComponents,
  makeCodeBlockPreHandler,
} from "./markdown-shared.tsx";

describe("markdown-shared", () => {
  test("normalizeMarkdown — separates heading from text", () => {
    const result = normalizeMarkdown("Text.### Heading");
    expect(result).toContain("\n\n### Heading");
  });

  test("extractText — extracts plain text from nested React nodes", () => {
    const node = (
      <span>
        Hello <strong>world</strong>
      </span>
    );
    const result = extractText(node);
    expect(result).toBe("Hello world");
  });

  test("CopyButton — renders copy icon with correct aria-label", () => {
    const html = renderToStaticMarkup(<CopyButton text="some code" />);
    expect(html).toContain('aria-label="Copy code"');
    expect(html).toContain("code-block__copy");
  });

  test("baseComponents — links open in new tab", () => {
    const html = renderToStaticMarkup(
      <ReactMarkdown components={baseComponents}>
        [link](https://example.com)
      </ReactMarkdown>,
    );
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  test("makeCodeBlockPreHandler — renders standard code block with language label and copy button", () => {
    const html = renderToStaticMarkup(
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{ pre: makeCodeBlockPreHandler() }}
      >
        {"```js\nconst x = 1;\n```"}
      </ReactMarkdown>,
    );
    expect(html).toContain('code-block__lang">js<');
    expect(html).toContain("code-block__copy");
  });

  test("makeCodeBlockPreHandler — does not parse conclave blocks", () => {
    const html = renderToStaticMarkup(
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{ pre: makeCodeBlockPreHandler() }}
      >
        {'```conclave:usecase\n{"id":"UC-1"}\n```'}
      </ReactMarkdown>,
    );
    expect(html).toContain("code-block");
    expect(html).toContain("conclave:usecase");
    expect(html).not.toContain("uc-card");
  });
});
