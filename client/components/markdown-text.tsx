import React, { useCallback, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import type { Components } from "react-markdown";
import type { UseCase, EventModelSlice } from "../types.ts";
import { EventModelDiagram } from "./event-model-diagram.tsx";
import { NextBlockButton, parseNextBlock } from "./next-block-button.tsx";
import type { NextBlockClickPayload } from "./next-block-button.tsx";

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

function UseCaseCard({ useCase }: { useCase: UseCase }) {
  return (
    <div
      className="uc-card"
      data-priority={useCase.priority}
    >
      <div className="uc-card__topline">
        <span className="uc-card__id">{useCase.id}</span>
        <span className={`uc-card__badge uc-card__badge--${useCase.priority}`}>
          {useCase.priority}
        </span>
      </div>

      <h3 className="uc-card__name">{useCase.name}</h3>

      <div className="uc-card__meta">
        <span className="uc-card__actor">{useCase.actor}</span>
      </div>

      <p className="uc-card__summary">{useCase.summary}</p>

      <div className="uc-card__scenario">
        <div className="uc-card__clause">
          <span className="uc-card__clause-keyword">Given</span>
          <ul className="uc-card__clause-items">
            {useCase.given.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </div>
        <div className="uc-card__clause">
          <span className="uc-card__clause-keyword">When</span>
          <ul className="uc-card__clause-items">
            {useCase.when.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </div>
        <div className="uc-card__clause">
          <span className="uc-card__clause-keyword">Then</span>
          <ul className="uc-card__clause-items">
            {useCase.then.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </div>
      </div>

      {useCase.dependencies && useCase.dependencies.length > 0 && (
        <div className="uc-card__deps">
          <span className="uc-card__deps-label">Depends on</span>
          <span className="uc-card__deps-list">
            {useCase.dependencies.map((dep) => (
              <span key={dep} className="uc-card__dep-id">{dep}</span>
            ))}
          </span>
        </div>
      )}
    </div>
  );
}

function InlineUseCases({ json }: { json: string }) {
  try {
    const parsed = JSON.parse(json);
    const useCases: UseCase[] = Array.isArray(parsed) ? parsed : [parsed];
    return (
      <>
        {useCases.map((uc) => (
          <UseCaseCard key={uc.id} useCase={uc} />
        ))}
      </>
    );
  } catch {
    return null;
  }
}

function parseEventModelSlice(json: string): EventModelSlice | null {
  try {
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === "object" && typeof parsed.slice === "string" && parsed.slice.length > 0) {
      return parsed as EventModelSlice;
    }
    return null;
  } catch {
    return null;
  }
}

const baseComponents: Components = {
  a: ({ children, href, ...props }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
      {children}
    </a>
  ),
};

function makePreHandler(onNextBlockClick?: (payload: NextBlockClickPayload) => void): Components["pre"] {
  return ({ children, ...props }) => {
    const codeChild = React.Children.toArray(children).find(
      (child) => React.isValidElement(child) && child.type === "code",
    ) as React.ReactElement<{ className?: string; children?: React.ReactNode }> | undefined;

    let language = "";
    if (codeChild?.props?.className) {
      const match = /language-(\S+)/.exec(codeChild.props.className);
      if (match) language = match[1];
    }

    // Render conclave:next blocks as a button or warning
    if (language === "conclave:next") {
      const codeText = codeChild ? extractText(codeChild.props.children).replace(/\n$/, "") : "";
      const parsed = parseNextBlock(codeText);
      if (parsed.valid) {
        if (parsed.metaContext) {
          return (
            <NextBlockButton
              label={parsed.label}
              command={parsed.command}
              metaContext={parsed.metaContext}
              onRun={onNextBlockClick ?? (() => {})}
              disabled={false}
            />
          );
        }
        // Missing metaContext — render warning
        return (
          <span className="next-block-warning" style={{ color: "var(--text-muted)", fontStyle: "italic", fontSize: "13px" }}>
            Next block missing metaContext
          </span>
        );
      }
      // Invalid JSON — fall through to normal code block
    }

    // Render conclave:usecase blocks as inline use case cards
    if (language === "conclave:usecase") {
      const codeText = codeChild ? extractText(codeChild.props.children).replace(/\n$/, "") : "";
      return <InlineUseCases json={codeText} />;
    }

    // Suppress valid conclave:eventmodel blocks (rendered as diagram after ReactMarkdown)
    if (language === "conclave:eventmodel") {
      const codeText = codeChild ? extractText(codeChild.props.children).replace(/\n$/, "") : "";
      const slice = parseEventModelSlice(codeText);
      if (slice) return null;
      // Invalid JSON: fall through to normal code block rendering
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
  };
}

export type MarkdownTextProps = {
  text: string;
  onNextBlockClick?: (payload: NextBlockClickPayload) => void;
};

export function MarkdownText({ text, onNextBlockClick }: MarkdownTextProps) {
  const memoComponents = useMemo<Components>(() => ({
    ...baseComponents,
    pre: makePreHandler(onNextBlockClick),
  }), [onNextBlockClick]);

  // Extract all valid conclave:eventmodel slices from raw text
  const validSlices: EventModelSlice[] = [];
  const eventModelRegex = /```conclave:eventmodel\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = eventModelRegex.exec(text)) !== null) {
    const slice = parseEventModelSlice(match[1]);
    if (slice) validSlices.push(slice);
  }

  return (
    <div className="message__text message__text--markdown">
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={memoComponents}
      >
        {text}
      </ReactMarkdown>
      {validSlices.length > 0 && <EventModelDiagram slices={validSlices} />}
    </div>
  );
}
