import React, { useState, useEffect, useRef } from "react";
import { TaskIcon, Chevron, GitStatusIcon } from "./icons.tsx";
import type { PlanEntryInfo, GitFileEntry, SpecInfo } from "../reducer.ts";

type SectionId = "specs" | "tasks" | "files";

type WorkspaceProps = {
  entries: PlanEntryInfo[];
  gitFiles: GitFileEntry[];
  specs: SpecInfo[];
};

export type GitFileGroups = {
  staged: GitFileEntry[];
  unstaged: GitFileEntry[];
  untracked: GitFileEntry[];
};

/** Partition git files into staged, unstaged, and untracked groups. A file can appear in both staged and unstaged. */
export function groupGitFiles(files: GitFileEntry[]): GitFileGroups {
  const staged: GitFileEntry[] = [];
  const unstaged: GitFileEntry[] = [];
  const untracked: GitFileEntry[] = [];

  for (const file of files) {
    if (file.indexStatus === "?" && file.workTreeStatus === "?") {
      untracked.push(file);
      continue;
    }
    if (file.indexStatus !== " " && file.indexStatus !== "?") {
      staged.push(file);
    }
    if (file.workTreeStatus !== " " && file.workTreeStatus !== "?") {
      unstaged.push(file);
    }
  }

  return { staged, unstaged, untracked };
}

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

function GitFileRow({ file, displayStatus }: { file: GitFileEntry; displayStatus: string }) {
  const fileName = file.path.split("/").pop() || file.path;

  return (
    <div className="file-change">
      <span className="file-change__icon">
        <GitStatusIcon status={displayStatus} />
      </span>
      <span className="file-change__name" title={file.path}>
        {fileName}
      </span>
    </div>
  );
}

function GitFileSubSection({
  label,
  files,
  statusKey,
}: {
  label: string;
  files: GitFileEntry[];
  statusKey: "indexStatus" | "workTreeStatus";
}) {
  if (files.length === 0) return null;
  return (
    <div className="workspace__files-subsection">
      <div className="workspace__files-subsection-header">
        <span className="workspace__files-subsection-label">{label}</span>
        <span className="workspace__files-subsection-count">{files.length}</span>
      </div>
      {files.map((file) => (
        <GitFileRow key={file.path} file={file} displayStatus={file[statusKey]} />
      ))}
    </div>
  );
}

function SpecIcon({ type }: { type: string }) {
  return (
    <span className={`spec-entry__icon spec-entry__icon--${type}`}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {type === "epic" ? (
          <>
            <rect x="2" y="2" width="10" height="10" rx="2" />
            <line x1="5" y1="5.5" x2="9" y2="5.5" />
            <line x1="5" y1="8.5" x2="8" y2="8.5" />
          </>
        ) : (
          <>
            <path d="M3.5,1.5 L8.5,1.5 L11,4 L11,12.5 L3.5,12.5 Z" />
            <polyline points="8.5,1.5 8.5,4 11,4" />
          </>
        )}
      </svg>
    </span>
  );
}

function SpecEntry({ spec }: { spec: SpecInfo }) {
  return (
    <div className="spec-entry">
      <SpecIcon type={spec.type} />
      <span className="spec-entry__name">{spec.name}</span>
      {spec.phase && (
        <span className={`spec-entry__phase spec-entry__phase--${spec.phase}`}>
          {spec.phase}
        </span>
      )}
    </div>
  );
}

type EpicGroup = {
  epic: SpecInfo;
  children: SpecInfo[];
};

function groupSpecs(specs: SpecInfo[]): { standalone: SpecInfo[]; epicGroups: EpicGroup[] } {
  const epicMap = new Map<string, SpecInfo>();
  const childrenMap = new Map<string, SpecInfo[]>();
  const standalone: SpecInfo[] = [];

  // First pass: identify epics
  for (const spec of specs) {
    if (spec.type === "epic") {
      epicMap.set(spec.name, spec);
    }
  }

  // Second pass: partition children and standalone
  for (const spec of specs) {
    if (spec.type === "epic") continue;
    if (spec.epic && epicMap.has(spec.epic)) {
      const children = childrenMap.get(spec.epic) ?? [];
      children.push(spec);
      childrenMap.set(spec.epic, children);
    } else {
      standalone.push(spec);
    }
  }

  // Build epic groups
  const epicGroups: EpicGroup[] = [];
  for (const [name, epic] of epicMap) {
    epicGroups.push({ epic, children: childrenMap.get(name) ?? [] });
  }

  return { standalone, epicGroups };
}

function EpicGroupRow({ group }: { group: EpicGroup }) {
  const implCount = group.children.filter((c) => c.phase === "implementation").length;
  const total = group.children.length;
  const summary = total > 0 ? `${implCount} of ${total} in implementation` : "";

  return (
    <div className="spec-epic-group">
      <div className="spec-epic-group__header">
        <span className="spec-epic-group__name">{group.epic.name}</span>
        {summary && (
          <span className="spec-epic-group__summary">{summary}</span>
        )}
      </div>
      {group.children.map((child) => (
        <div key={child.name} className="spec-epic-group__child">
          <SpecEntry spec={child} />
        </div>
      ))}
    </div>
  );
}

function specsSummary(specs: SpecInfo[]): string {
  const count = specs.filter((s) => s.type !== "epic").length;
  return `${count} spec${count === 1 ? "" : "s"}`;
}

function tasksSummary(entries: PlanEntryInfo[]): string {
  const completed = entries.filter((e) => e.status === "completed").length;
  return `${completed} / ${entries.length} completed`;
}

function filesSummary(gitFiles: GitFileEntry[]): string {
  // Deduplicated count — a file in both staged and unstaged still counts once
  const count = gitFiles.length;
  return `${count} file${count === 1 ? "" : "s"}`;
}

export function Workspace({
  entries,
  gitFiles,
  specs,
}: WorkspaceProps) {
  const hasEntries = entries.length > 0;
  const hasFiles = gitFiles.length > 0;
  const hasSpecs = specs.length > 0;
  const hasContent = hasEntries || hasFiles || hasSpecs;

  const [expandedSection, setExpandedSection] = useState<SectionId | null>(null);

  // Track whether auto-expand has fired so manual toggles aren't overridden
  const autoExpandedRef = useRef(false);

  // Auto-expand first section to receive content
  useEffect(() => {
    if (autoExpandedRef.current) return;
    if (hasEntries) {
      setExpandedSection("tasks");
      autoExpandedRef.current = true;
    } else if (hasFiles) {
      setExpandedSection("files");
      autoExpandedRef.current = true;
    } else if (hasSpecs) {
      setExpandedSection("specs");
      autoExpandedRef.current = true;
    }
  }, [hasEntries, hasFiles, hasSpecs]);

  // If tasks arrive after another section was auto-expanded, switch to tasks
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
        {hasSpecs && (
          <div className="workspace__specs-section">
            <button
              type="button"
              className="workspace__section-header"
              onClick={() => handleToggle("specs")}
              aria-expanded={expandedSection === "specs"}
            >
              <Chevron expanded={expandedSection === "specs"} />
              <span className="workspace__section-label">Specs</span>
              {expandedSection !== "specs" && (
                <span className="workspace__section-summary">
                  {specsSummary(specs)}
                </span>
              )}
            </button>
            {expandedSection === "specs" && (
              <div className="workspace__specs">
                {(() => {
                  const { standalone, epicGroups } = groupSpecs(specs);
                  return (
                    <>
                      {standalone.map((spec) => (
                        <SpecEntry key={spec.name} spec={spec} />
                      ))}
                      {epicGroups.map((group) => (
                        <EpicGroupRow key={group.epic.name} group={group} />
                      ))}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}

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
                  {filesSummary(gitFiles)}
                </span>
              )}
            </button>
            {expandedSection === "files" && (
              <div className="workspace__files">
                {(() => {
                  const { staged, unstaged, untracked } = groupGitFiles(gitFiles);
                  return (
                    <>
                      <GitFileSubSection label="Staged" files={staged} statusKey="indexStatus" />
                      <GitFileSubSection label="Unstaged" files={unstaged} statusKey="workTreeStatus" />
                      <GitFileSubSection label="Untracked" files={untracked} statusKey="workTreeStatus" />
                    </>
                  );
                })()}
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
