import React, { useState, useCallback } from "react";
import { MarkdownText } from "./markdown-text.tsx";
import { TaskIcon } from "./icons.tsx";
import type { PlanEntryInfo, PendingPermission } from "../reducer.ts";

type WorkspaceProps = {
  entries: PlanEntryInfo[];
  currentMode: string;
  planContent: string;
  pendingPermission: PendingPermission | null;
  onPermissionResponse: (optionId: string, feedback?: string) => void;
};

function PlanEntry({ entry }: { entry: PlanEntryInfo }) {
  return (
    <div className={`plan-entry plan-entry--${entry.status}`}>
      <span className="plan-entry__icon">
        <TaskIcon status={entry.status} />
      </span>
      <span className="plan-entry__content">{entry.content}</span>
      {entry.priority === "high" && (
        <span className="plan-entry__priority">high</span>
      )}
    </div>
  );
}

export function Workspace({
  entries,
  currentMode,
  planContent,
  pendingPermission,
  onPermissionResponse,
}: WorkspaceProps) {
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [feedbackOptionId, setFeedbackOptionId] = useState<string | null>(null);

  const displayText = planContent;
  const isPlanning = currentMode === "plan" && !pendingPermission && !planContent;

  const handleOptionClick = useCallback(
    (optionId: string, kind: string) => {
      if (kind === "reject_once") {
        // Show feedback input for rejection
        setFeedbackOptionId(optionId);
        setShowFeedback(true);
      } else {
        onPermissionResponse(optionId);
      }
    },
    [onPermissionResponse],
  );

  const handleSendFeedback = useCallback(() => {
    const trimmed = feedback.trim();
    if (!trimmed || !feedbackOptionId) return;
    onPermissionResponse(feedbackOptionId, trimmed);
    setFeedback("");
    setShowFeedback(false);
    setFeedbackOptionId(null);
  }, [feedback, feedbackOptionId, onPermissionResponse]);

  const handleCancelFeedback = useCallback(() => {
    setShowFeedback(false);
    setFeedback("");
    setFeedbackOptionId(null);
  }, []);

  const handleFeedbackKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendFeedback();
      }
      if (e.key === "Escape") {
        handleCancelFeedback();
      }
    },
    [handleSendFeedback, handleCancelFeedback],
  );

  return (
    <div className="workspace">
      <header className="workspace__header">
        Workspace
        {currentMode === "plan" && (
          <span className="workspace__mode-badge">Planning</span>
        )}
      </header>
      <div className="workspace__content">
        {!displayText && !isPlanning && entries.length === 0 && (
          <div className="workspace__empty">
            No plan yet. Start a conversation and Claude will build a plan here.
          </div>
        )}
        {displayText && (
          <div className="workspace__markdown">
            <MarkdownText text={displayText} />
          </div>
        )}
        {isPlanning && !displayText && (
          <div className="workspace__streaming-indicator">Planning...</div>
        )}
        {entries.length > 0 && (
          <div className="workspace__tasks-section">
            <div className="workspace__tasks-label">Tasks</div>
            <div className="workspace__entries">
              {entries.map((entry, i) => (
                <PlanEntry key={i} entry={entry} />
              ))}
            </div>
          </div>
        )}
      </div>
      {pendingPermission && !showFeedback && (
        <div className="workspace__approval">
          {pendingPermission.options.map((option) => (
            <button
              key={option.optionId}
              className={`workspace__approval-btn workspace__approval-btn--${option.kind}`}
              onClick={() => handleOptionClick(option.optionId, option.kind)}
            >
              {option.name}
            </button>
          ))}
        </div>
      )}
      {showFeedback && (
        <div className="workspace__feedback">
          <textarea
            className="workspace__feedback-input"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            onKeyDown={handleFeedbackKeyDown}
            placeholder="What should be changed?"
            rows={3}
            autoFocus
          />
          <div className="workspace__feedback-actions">
            <button
              className="workspace__feedback-btn workspace__feedback-btn--send"
              onClick={handleSendFeedback}
              disabled={!feedback.trim()}
            >
              Send Feedback
            </button>
            <button
              className="workspace__feedback-btn workspace__feedback-btn--cancel"
              onClick={handleCancelFeedback}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
