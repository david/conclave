import React, { useState, useCallback } from "react";
import { MarkdownText } from "./markdown-text.tsx";
import { TaskIcon, FileActionIcon } from "./icons.tsx";
import type { PlanEntryInfo, PendingPermission, FileChangeInfo } from "../reducer.ts";

type WorkspaceProps = {
  entries: PlanEntryInfo[];
  fileChanges: FileChangeInfo[];
  currentMode: string;
  planContent: string;
  isProcessing: boolean;
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

function FileChangeRow({ fileChange }: { fileChange: FileChangeInfo }) {
  const fileName = fileChange.filePath.split("/").pop() || fileChange.filePath;

  return (
    <div className={`file-change file-change--${fileChange.status}`}>
      <span className="file-change__icon">
        <FileActionIcon action={fileChange.action} />
      </span>
      <span className="file-change__name" title={fileChange.filePath}>
        {fileName}
      </span>
      <span className={`file-change__action file-change__action--${fileChange.action}`}>
        {fileChange.action}
      </span>
    </div>
  );
}

export function Workspace({
  entries,
  fileChanges,
  currentMode,
  planContent,
  isProcessing,
  pendingPermission,
  onPermissionResponse,
}: WorkspaceProps) {
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [feedbackOptionId, setFeedbackOptionId] = useState<string | null>(null);

  const isPlanReview = currentMode === "plan" || pendingPermission !== null;
  const isWip = !isPlanReview && isProcessing && (fileChanges.length > 0 || entries.length > 0);
  const isPlanning = currentMode === "plan" && !pendingPermission && !planContent;

  const handleOptionClick = useCallback(
    (optionId: string, kind: string) => {
      if (kind === "reject_once") {
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
        {isPlanReview && (
          <span className="workspace__mode-badge">Planning</span>
        )}
        {isWip && (
          <span className="workspace__mode-badge workspace__mode-badge--wip">Working</span>
        )}
      </header>
      <div className="workspace__content">
        {/* Plan review view */}
        {isPlanReview && (
          <>
            {!planContent && isPlanning && (
              <div className="workspace__streaming-indicator">Planning...</div>
            )}
            {planContent && (
              <div className="workspace__markdown">
                <MarkdownText text={planContent} />
              </div>
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
          </>
        )}

        {/* WIP view */}
        {isWip && (
          <>
            {entries.length > 0 && (
              <div className="workspace__tasks-section workspace__tasks-section--primary">
                <div className="workspace__tasks-label">Tasks</div>
                <div className="workspace__entries">
                  {entries.map((entry, i) => (
                    <PlanEntry key={i} entry={entry} />
                  ))}
                </div>
              </div>
            )}
            {fileChanges.length > 0 && (
              <div className="workspace__files-section">
                <div className="workspace__files-label">Files</div>
                <div className="workspace__files">
                  {fileChanges.map((fc) => (
                    <FileChangeRow key={fc.filePath} fileChange={fc} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Empty state */}
        {!isPlanReview && !isWip && (
          <div className="workspace__empty">
            No plan yet. Start a conversation and Claude will build a plan here.
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
            className="textarea-base workspace__feedback-input"
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
