import React from "react";
import { TaskIcon, FileActionIcon } from "./icons.tsx";
import { ModePicker } from "./mode-picker.tsx";
import type { PlanEntryInfo, FileChangeInfo, UseCase } from "../reducer.ts";
import type { ModeClientInfo } from "../../server/types.ts";

type WorkspaceProps = {
  entries: PlanEntryInfo[];
  fileChanges: FileChangeInfo[];
  useCases: UseCase[];
  currentMode: string;
  availableModes: ModeClientInfo[];
  isProcessing: boolean;
  onSetMode: (modeId: string) => void;
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

function UseCaseCard({ useCase }: { useCase: UseCase }) {
  return (
    <div className="use-case" data-priority={useCase.priority}>
      <div className="use-case__header">
        <span className="use-case__id">{useCase.id}</span>
        <span className={`use-case__priority use-case__priority--${useCase.priority}`}>
          {useCase.priority}
        </span>
      </div>
      <div className="use-case__name">{useCase.name}</div>
      <div className="use-case__actor">{useCase.actor}</div>
      <div className="use-case__summary">{useCase.summary}</div>
      <div className="use-case__steps">
        <div className="use-case__step-group">
          <span className="use-case__step-label">Given</span>
          <ul className="use-case__step-list">
            {useCase.given.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </div>
        <div className="use-case__step-group">
          <span className="use-case__step-label">When</span>
          <ul className="use-case__step-list">
            {useCase.when.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </div>
        <div className="use-case__step-group">
          <span className="use-case__step-label">Then</span>
          <ul className="use-case__step-list">
            {useCase.then.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function Workspace({
  entries,
  fileChanges,
  useCases,
  currentMode,
  availableModes,
  isProcessing,
  onSetMode,
}: WorkspaceProps) {
  const hasEntries = entries.length > 0;
  const hasFiles = fileChanges.length > 0;
  const hasUseCases = useCases.length > 0;
  const hasContent = hasEntries || hasFiles || hasUseCases;

  return (
    <div className="workspace">
      <header className="workspace__header">
        <ModePicker
          modes={availableModes}
          currentMode={currentMode}
          onSetMode={onSetMode}
          disabled={isProcessing}
        />
        {isProcessing && (
          <span className="workspace__status-badge" data-color={availableModes.find((m) => m.id === currentMode)?.color ?? "neutral"}>
            Working<span className="workspace__status-dots" />
          </span>
        )}
      </header>
      <div className="workspace__content">
        {hasUseCases && (
          <div className="workspace__use-cases-section">
            <div className="workspace__use-cases-label">Use Cases</div>
            <div className="workspace__use-cases">
              {useCases.map((uc) => (
                <UseCaseCard key={uc.id} useCase={uc} />
              ))}
            </div>
          </div>
        )}

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

        {!hasContent && !isProcessing && (
          <div className="workspace__empty">
            Tasks and file changes will appear here.
          </div>
        )}
      </div>
    </div>
  );
}
