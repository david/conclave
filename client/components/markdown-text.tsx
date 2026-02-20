import React, { useCallback, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import type { Components } from "react-markdown";

const remarkPlugins = [remarkGfm];
const rehypePlugins = [rehypeHighlight];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);

  return (
    <button
      className={`code-block__copy${copied ? " code-block__copy--copied" : ""}`}
      onClick={handleCopy}
      title={copied ? "Copied!" : "Copy code"}
      aria-label={copied ? "Copied!" : "Copy code"}
    >
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3.5 8.5 6.5 11.5 12.5 5" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
          <path d="M10.5 5.5V3.5a1.5 1.5 0 0 0-1.5-1.5H3.5A1.5 1.5 0 0 0 2 3.5V9a1.5 1.5 0 0 0 1.5 1.5h2" />
        </svg>
      )}
    </button>
  );
}

function extractText(node: React.ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (!node) return "";
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (typeof node === "object" && "props" in node) {
    const el = node as React.ReactElement<{ children?: React.ReactNode }>;
    return extractText(el.props.children);
  }
  return "";
}

const components: Components = {
  a: ({ children, href, ...props }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
      {children}
    </a>
  ),
  pre: ({ children, ...props }) => {
    const codeChild = React.Children.toArray(children).find(
      (child) => React.isValidElement(child) && child.type === "code",
    ) as React.ReactElement<{ className?: string; children?: React.ReactNode }> | undefined;

    let language = "";
    if (codeChild?.props?.className) {
      const match = /language-(\S+)/.exec(codeChild.props.className);
      if (match) language = match[1];
    }

    const codeText = codeChild ? extractText(codeChild.props.children).replace(/\n$/, "") : "";

    return (
      <div className="code-block">
        <div className="code-block__header">
          <span className="code-block__lang">{language || "text"}</span>
          <CopyButton text={codeText} />
        </div>
        <pre {...props}>{children}</pre>
      </div>
    );
  },
};

/** Strip conclave:requirements fenced blocks — they render in the workspace, not in chat. */
const CONCLAVE_BLOCK_RE = /```conclave:\w+\n[\s\S]*?```\n?/g;

function stripConclaveBlocks(text: string): string {
  return text.replace(CONCLAVE_BLOCK_RE, "");
}

export function MarkdownText({ text }: { text: string }) {
  const cleaned = stripConclaveBlocks(text);
  return (
    <div className="message__text message__text--markdown">
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={components}
      >
        {cleaned}
      </ReactMarkdown>
    </div>
  );
}
