import React, { useState, useEffect, useRef } from "react";
import { TaskIcon, FileActionIcon, Chevron } from "./icons.tsx";
import type { PlanEntryInfo, FileChangeInfo } from "../reducer.ts";

type SectionId = "tasks" | "files";

type WorkspaceProps = {
  entries: PlanEntryInfo[];
  fileChanges: FileChangeInfo[];
};

function PlanEntry({ entry }: { entry: PlanEntryInfo }) {
  return (
    <div className="plan-entry" data-status={entry.status}>
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
    <div className="file-change" data-status={fileChange.status}>
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

function tasksSummary(entries: PlanEntryInfo[]): string {
  const completed = entries.filter((e) => e.status === "completed").length;
  return `${completed} / ${entries.length} completed`;
}

function filesSummary(fileChanges: FileChangeInfo[]): string {
  const count = fileChanges.length;
  return `${count} file${count === 1 ? "" : "s"} changed`;
}

export function Workspace({
  entries,
  fileChanges,
}: WorkspaceProps) {
  const hasEntries = entries.length > 0;
  const hasFiles = fileChanges.length > 0;
  const hasContent = hasEntries || hasFiles;

  const [expandedSection, setExpandedSection] = useState<SectionId | null>(null);

  // Track whether auto-expand has fired so manual toggles aren't overridden
  const autoExpandedRef = useRef(false);

  // UC-3: Default to tasks when they have content
  // UC-4: Otherwise, expand first section to receive content
  useEffect(() => {
    if (autoExpandedRef.current) return;
    if (hasEntries) {
      setExpandedSection("tasks");
      autoExpandedRef.current = true;
    } else if (hasFiles) {
      setExpandedSection("files");
      autoExpandedRef.current = true;
    }
  }, [hasEntries, hasFiles]);

  // UC-3 continued: If tasks arrive after files were auto-expanded, switch to tasks
  const prevHasEntries = useRef(hasEntries);
  useEffect(() => {
    if (!prevHasEntries.current && hasEntries) {
      setExpandedSection("tasks");
    }
    prevHasEntries.current = hasEntries;
  }, [hasEntries]);

  // UC-1: Toggle — clicking the expanded section's header is a no-op (always one open);
  // clicking a collapsed section expands it and collapses the other.
  const handleToggle = (section: SectionId) => {
    if (section !== expandedSection) {
      setExpandedSection(section);
    }
  };

  return (
    <div className="workspace">
      <div className="workspace__content">
        {hasEntries && (
          <div className="workspace__tasks-section">
            <button
              type="button"
              className="workspace__section-header"
              onClick={() => handleToggle("tasks")}
              aria-expanded={expandedSection === "tasks"}
            >
              <Chevron expanded={expandedSection === "tasks"} />
              <span className="workspace__section-label">Tasks</span>
              {expandedSection !== "tasks" && (
                <span className="workspace__section-summary">
                  {tasksSummary(entries)}
                </span>
              )}
            </button>
            {expandedSection === "tasks" && (
              <div className="workspace__entries">
                {entries.map((entry, i) => (
                  <PlanEntry key={i} entry={entry} />
                ))}
              </div>
            )}
          </div>
        )}

        {hasFiles && (
          <div className="workspace__files-section">
            <button
              type="button"
              className="workspace__section-header"
              onClick={() => handleToggle("files")}
              aria-expanded={expandedSection === "files"}
            >
              <Chevron expanded={expandedSection === "files"} />
              <span className="workspace__section-label">Files</span>
              {expandedSection !== "files" && (
                <span className="workspace__section-summary">
                  {filesSummary(fileChanges)}
                </span>
              )}
            </button>
            {expandedSection === "files" && (
              <div className="workspace__files">
                {fileChanges.map((fc) => (
                  <FileChangeRow key={fc.filePath} fileChange={fc} />
                ))}
              </div>
            )}
          </div>
        )}

        {!hasContent && (
          <div className="workspace__empty">
            Tasks and file changes will appear here.
          </div>
        )}
      </div>
    </div>
  );
}
