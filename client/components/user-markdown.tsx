import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeHighlight from "rehype-highlight";
import type { Components } from "react-markdown";
import { normalizeMarkdown, baseComponents, makeCodeBlockPreHandler } from "./markdown-shared.tsx";

const remarkPlugins = [remarkGfm, remarkBreaks];
const rehypePlugins = [rehypeHighlight];
const components: Components = {
  ...baseComponents,
  pre: makeCodeBlockPreHandler(),
};

export function UserMarkdown({ text }: { text: string }) {
  const normalizedText = useMemo(
    () => normalizeMarkdown(text.replace(/\\n/g, "\n")),
    [text],
  );

  return (
    <div className="message__text message__text--markdown">
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={components}
      >
        {normalizedText}
      </ReactMarkdown>
    </div>
  );
}
