import { describe, test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { UserMarkdown } from "./user-markdown.tsx";

describe("UserMarkdown", () => {
  test("renders basic markdown formatting", () => {
    const html = renderToStaticMarkup(
      <UserMarkdown text="**bold** and `code`\n\n- item one\n- item two" />,
    );
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<code>code</code>");
    // Two list items
    expect(html).toContain("<li>item one</li>");
    expect(html).toContain("<li>item two</li>");
  });

  test("renders links with target blank", () => {
    const html = renderToStaticMarkup(
      <UserMarkdown text="[link](https://example.com)" />,
    );
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  test("renders code blocks with language label and copy button", () => {
    const html = renderToStaticMarkup(
      <UserMarkdown text={"```python\nprint('hi')\n```"} />,
    );
    expect(html).toContain('code-block__lang">python<');
    expect(html).toContain("code-block__copy");
  });

  test("single newline renders as line break via remark-breaks", () => {
    const html = renderToStaticMarkup(
      <UserMarkdown text="line one\nline two" />,
    );
    expect(html).toContain("<br");
  });

  test("double newline creates paragraph break", () => {
    const html = renderToStaticMarkup(
      <UserMarkdown text="paragraph one\n\nparagraph two" />,
    );
    // Should have two separate paragraphs
    const pCount = (html.match(/<p>/g) || []).length;
    expect(pCount).toBe(2);
    // Should NOT have a br between them
    const betweenPs = html.split("paragraph one")[1].split("paragraph two")[0];
    expect(betweenPs).not.toContain("<br");
  });

  test("conclave:usecase block renders as plain code block", () => {
    const html = renderToStaticMarkup(
      <UserMarkdown text={'```conclave:usecase\n{"id":"UC-1","name":"Test"}\n```'} />,
    );
    expect(html).toContain("code-block");
    expect(html).not.toContain("uc-card");
  });

  test("conclave:eventmodel block renders as plain code block", () => {
    const html = renderToStaticMarkup(
      <UserMarkdown text={'```conclave:eventmodel\n{"slice":"test","events":[{"name":"E"}]}\n```'} />,
    );
    expect(html).toContain("code-block");
    expect(html).not.toContain("em-diagram");
  });

  test("conclave:next block renders as plain code block", () => {
    const html = renderToStaticMarkup(
      <UserMarkdown text={'```conclave:next\n{"label":"Go","command":"/run","metaContext":"x"}\n```'} />,
    );
    expect(html).toContain("code-block");
    expect(html).not.toContain("next-block__diamond");
  });

  test("applies normalizeMarkdown to input", () => {
    const html = renderToStaticMarkup(
      <UserMarkdown text="Some text.### Heading" />,
    );
    expect(html).toContain("<h3");
  });

  test("wraps output in message__text--markdown class", () => {
    const html = renderToStaticMarkup(
      <UserMarkdown text="hello" />,
    );
    expect(html).toContain("message__text--markdown");
  });
});
