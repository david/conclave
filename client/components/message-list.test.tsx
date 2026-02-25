import { describe, test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { MessageList } from "./message-list.tsx";
import type { Message, ContentBlock, TextBlock } from "../types.ts";

function nextBlockText(label: string, command: string, metaContext: string): string {
  const json = JSON.stringify({ label, command, metaContext });
  return "```conclave:next\n" + json + "\n```";
}

function textBlock(text: string): TextBlock {
  return { type: "text", text };
}

function userMsg(text: string): Message {
  return { role: "user", content: [textBlock(text)] };
}

function assistantMsg(text: string): Message {
  return { role: "assistant", content: [textBlock(text)] };
}

describe("MessageList isReplay computation", () => {
  test("last assistant message renders next-block button as enabled", () => {
    const messages: Message[] = [
      userMsg("Hello"),
      assistantMsg(nextBlockText("Continue", "/next", "test-spec")),
    ];

    const html = renderToStaticMarkup(
      <MessageList
        messages={messages}
        streamingContent={[]}
        isProcessing={false}
        onNextBlockClick={() => {}}
      />,
    );

    expect(html).toContain("next-block__diamond");
    expect(html).not.toContain("next-block--disabled");
    expect(html).toContain('aria-disabled="false"');
  });

  test("earlier assistant messages render next-block buttons as disabled", () => {
    const messages: Message[] = [
      userMsg("Hello"),
      assistantMsg(nextBlockText("Step 1", "/step1", "spec-a")),
      userMsg("Continue"),
      assistantMsg(nextBlockText("Step 2", "/step2", "spec-b")),
    ];

    const html = renderToStaticMarkup(
      <MessageList
        messages={messages}
        streamingContent={[]}
        isProcessing={false}
        onNextBlockClick={() => {}}
      />,
    );

    // Both buttons should be present
    expect(html).toContain("Step 1");
    expect(html).toContain("Step 2");

    // The first assistant's button should be disabled, the second should not.
    // Split the HTML at the user message boundary ("Continue") between the two assistant messages.
    const splitPoint = html.indexOf("Continue");
    const firstSection = html.slice(0, splitPoint);
    const secondSection = html.slice(splitPoint);

    expect(firstSection).toContain("next-block--disabled");
    expect(secondSection).toContain("next-block__diamond");
    expect(secondSection).not.toContain("next-block--disabled");
  });

  test("committed messages during streaming have disabled buttons", () => {
    const messages: Message[] = [
      userMsg("Hello"),
      assistantMsg(nextBlockText("Do thing", "/do", "spec-c")),
    ];

    const streamingContent: ContentBlock[] = [
      textBlock("Streaming response..."),
    ];

    const html = renderToStaticMarkup(
      <MessageList
        messages={messages}
        streamingContent={streamingContent}
        isProcessing={true}
        onNextBlockClick={() => {}}
      />,
    );

    expect(html).toContain("next-block__diamond");
    expect(html).toContain("next-block--disabled");
  });

  test("no streaming content: last assistant button is enabled", () => {
    const messages: Message[] = [
      userMsg("Hello"),
      assistantMsg(nextBlockText("Run it", "/run", "spec-d")),
    ];

    const html = renderToStaticMarkup(
      <MessageList
        messages={messages}
        streamingContent={[]}
        isProcessing={false}
        onNextBlockClick={() => {}}
      />,
    );

    expect(html).toContain("next-block__diamond");
    expect(html).not.toContain("next-block--disabled");
  });
});

describe("MessageList user message markdown rendering", () => {
  test("user text blocks render with markdown formatting", () => {
    const messages: Message[] = [userMsg("**bold** text")];
    const html = renderToStaticMarkup(
      <MessageList
        messages={messages}
        streamingContent={[]}
        isProcessing={false}
      />,
    );
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("message__text--markdown");
  });

  test("user messages get line breaks from remark-breaks", () => {
    const messages: Message[] = [userMsg("line one\nline two")];
    const html = renderToStaticMarkup(
      <MessageList
        messages={messages}
        streamingContent={[]}
        isProcessing={false}
      />,
    );
    expect(html).toContain("<br");
  });

  test("assistant text blocks still render conclave blocks", () => {
    const messages: Message[] = [
      assistantMsg(nextBlockText("Continue", "/next", "test-spec")),
    ];
    const html = renderToStaticMarkup(
      <MessageList
        messages={messages}
        streamingContent={[]}
        isProcessing={false}
        onNextBlockClick={() => {}}
      />,
    );
    expect(html).toContain("next-block__diamond");
  });
});
