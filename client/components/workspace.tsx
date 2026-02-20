import React from "react";
import { TaskIcon, FileActionIcon } from "./icons.tsx";
import type { PlanEntryInfo, FileChangeInfo } from "../reducer.ts";

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

export function Workspace({
  entries,
  fileChanges,
}: WorkspaceProps) {
  const hasEntries = entries.length > 0;
  const hasFiles = fileChanges.length > 0;
  const hasContent = hasEntries || hasFiles;

  return (
    <div className="workspace">

      <div className="workspace__content">
        {hasEntries && (
          <div className="workspace__tasks-section">
            <div className="workspace__tasks-label">Tasks</div>
            <div className="workspace__entries">
              {entries.map((entry, i) => (
                <PlanEntry key={i} entry={entry} />
              ))}
            </div>
          </div>
        )}

        {hasFiles && (
          <div className="workspace__files-section">
            <div className="workspace__files-label">Files</div>
            <div className="workspace__files">
              {fileChanges.map((fc) => (
                <FileChangeRow key={fc.filePath} fileChange={fc} />
              ))}
            </div>
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
