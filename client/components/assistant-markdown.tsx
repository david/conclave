import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import type { Components } from "react-markdown";
import type { UseCase, EventModelSlice } from "../types.ts";
import { EventModelDiagram } from "./event-model-diagram.tsx";
import { NextBlockButton, parseNextBlock } from "./next-block-button.tsx";
import type { NextBlockClickPayload } from "./next-block-button.tsx";
import { normalizeMarkdown, CopyButton, extractText, baseComponents } from "./markdown-shared.tsx";

const remarkPlugins = [remarkGfm];
const rehypePlugins = [rehypeHighlight];

function toArray(value: string | string[]): string[] {
  return Array.isArray(value) ? value : [value];
}

function UseCaseCard({ useCase }: { useCase: UseCase }) {
  const given = toArray(useCase.given);
  const when = toArray(useCase.when);
  const then = toArray(useCase.then);
  return (
    <div className="uc-card" data-priority={useCase.priority}>
      <div className="uc-card__topline">
        <span className="uc-card__id">{useCase.id}</span>
        <span className={`uc-card__badge uc-card__badge--${useCase.priority}`}>{useCase.priority}</span>
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
            {given.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </div>
        <div className="uc-card__clause">
          <span className="uc-card__clause-keyword">When</span>
          <ul className="uc-card__clause-items">
            {when.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </div>
        <div className="uc-card__clause">
          <span className="uc-card__clause-keyword">Then</span>
          <ul className="uc-card__clause-items">
            {then.map((item, i) => <li key={i}>{item}</li>)}
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

function makePreHandler(onNextBlockClick?: (payload: NextBlockClickPayload) => void, isReplay?: boolean): Components["pre"] {
  return ({ children, ...props }) => {
    const codeChild = React.Children.toArray(children).find(
      (child) => React.isValidElement(child) && child.type === "code",
    ) as React.ReactElement<{ className?: string; children?: React.ReactNode }> | undefined;

    let language = "";
    if (codeChild?.props?.className) {
      const match = /language-(\S+)/.exec(codeChild.props.className);
      if (match) language = match[1];
    }

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
              disabled={!!isReplay}
            />
          );
        }
        return (
          <span className="next-block-warning" style={{ color: "var(--text-muted)", fontStyle: "italic", fontSize: "13px" }}>
            Next block missing metaContext
          </span>
        );
      }
    }

    if (language === "conclave:usecase") {
      const codeText = codeChild ? extractText(codeChild.props.children).replace(/\n$/, "") : "";
      return <InlineUseCases json={codeText} />;
    }

    if (language === "conclave:eventmodel") {
      const codeText = codeChild ? extractText(codeChild.props.children).replace(/\n$/, "") : "";
      const slice = parseEventModelSlice(codeText);
      if (slice) return null;
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

export type AssistantMarkdownProps = {
  text: string;
  onNextBlockClick?: (payload: NextBlockClickPayload) => void;
  isReplay?: boolean;
};

export function AssistantMarkdown({ text, onNextBlockClick, isReplay }: AssistantMarkdownProps) {
  const normalizedText = useMemo(() => normalizeMarkdown(text.replace(/\\n/g, "\n")), [text]);
  const memoComponents = useMemo<Components>(() => ({
    ...baseComponents,
    pre: makePreHandler(onNextBlockClick, isReplay),
  }), [onNextBlockClick, isReplay]);

  const validSlices: EventModelSlice[] = [];
  const eventModelRegex = /```conclave:eventmodel\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = eventModelRegex.exec(normalizedText)) !== null) {
    const slice = parseEventModelSlice(match[1]);
    if (slice) validSlices.push(slice);
  }

  return (
    <div className="message__text message__text--markdown">
      <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={memoComponents}>
        {normalizedText}
      </ReactMarkdown>
      {validSlices.length > 0 && <EventModelDiagram slices={validSlices} />}
    </div>
  );
}
