import React, { useState, useEffect, useRef } from "react";
import { TaskIcon, GitStatusIcon, ServiceStatusIcon, ServicesIcon, SpecsIcon, TasksIcon, FilesIcon } from "./icons.tsx";
import type { PlanEntryInfo, GitFileEntry, SpecInfo, ServiceProcess } from "../reducer.ts";

type SectionId = "services" | "specs" | "tasks" | "files";

type WorkspaceProps = {
  entries: PlanEntryInfo[];
  gitFiles: GitFileEntry[];
  specs: SpecInfo[];
  services: ServiceProcess[];
  servicesAvailable: boolean;
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

export function GitFileRow({ file, displayStatus }: { file: GitFileEntry; displayStatus: string }) {
  const fileName = file.path.split("/").pop() || file.path;
  const hasLineChanges = file.linesAdded !== 0 || file.linesDeleted !== 0;

  return (
    <div className="file-change">
      <span className="file-change__icon">
        <GitStatusIcon status={displayStatus} />
      </span>
      <span className="file-change__name" title={file.path}>
        {fileName}
      </span>
      {hasLineChanges && (
        <>
          <span className="git-file__additions">{`+${file.linesAdded}`}</span>
          <span className="git-file__deletions">{`-${file.linesDeleted}`}</span>
        </>
      )}
    </div>
  );
}

/** Sort order for git statuses: staged first, then unstaged, then untracked. */
const statusOrder: Record<string, number> = { A: 0, M: 1, D: 2, R: 3, "?": 4 };

function effectiveStatus(file: GitFileEntry): string {
  // Prefer index status (staged) over work-tree status
  if (file.indexStatus !== " " && file.indexStatus !== "?") return file.indexStatus;
  return file.workTreeStatus;
}

function sortedGitFiles(files: GitFileEntry[]): GitFileEntry[] {
  return [...files].sort((a, b) => {
    const sa = statusOrder[effectiveStatus(a)] ?? 9;
    const sb = statusOrder[effectiveStatus(b)] ?? 9;
    if (sa !== sb) return sa - sb;
    return a.path.localeCompare(b.path);
  });
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
            <path d="M2,1.5 L7,1.5 L9.5,4 L9.5,12.5 L2,12.5 Z" />
            <polyline points="7,1.5 7,4 9.5,4" />
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

function ServiceRow({ service }: { service: ServiceProcess }) {
  return (
    <div className="service-row">
      <span className="service-row__icon">
        <ServiceStatusIcon status={service.status} />
      </span>
      <span className="service-row__name">{service.name}</span>
      <span className="service-row__uptime">{service.uptime}</span>
    </div>
  );
}

export function filesSummary(gitFiles: GitFileEntry[]): string {
  // Deduplicated count — a file in both staged and unstaged still counts once
  const count = gitFiles.length;
  const totalAdded = gitFiles.reduce((sum, f) => sum + f.linesAdded, 0);
  const totalDeleted = gitFiles.reduce((sum, f) => sum + f.linesDeleted, 0);
  const base = `${count} file${count === 1 ? "" : "s"}`;
  if (totalAdded === 0 && totalDeleted === 0) return base;
  return `${base}  +${totalAdded} / -${totalDeleted}`;
}

/* ── Icon Bar sub-component ─────────────────────── */

type IconBarProps = {
  activeSection: SectionId | null;
  onSelect: (section: SectionId) => void;
  hasServices: boolean;
  hasSpecs: boolean;
  hasEntries: boolean;
  hasFiles: boolean;
};

function IconBar({ activeSection, onSelect, hasServices, hasSpecs, hasEntries, hasFiles }: IconBarProps) {
  const sections: { id: SectionId; icon: React.FC<{ size?: number; className?: string }>; has: boolean }[] = [
    { id: "services", icon: ServicesIcon, has: hasServices },
    { id: "specs", icon: SpecsIcon, has: hasSpecs },
    { id: "tasks", icon: TasksIcon, has: hasEntries },
    { id: "files", icon: FilesIcon, has: hasFiles },
  ];

  return (
    <nav className="icon-bar">
      {sections.map(({ id, icon: Icon, has }) => {
        const isActive = activeSection === id;
        const isDimmed = !has;
        const classes = [
          "icon-bar__item",
          isActive ? "icon-bar__item--active" : "",
          isDimmed ? "icon-bar__item--dimmed" : "",
        ].filter(Boolean).join(" ");

        return (
          <div
            key={id}
            className={classes}
            onClick={() => !isDimmed && onSelect(id)}
          >
            <Icon size={20} />
          </div>
        );
      })}
    </nav>
  );
}

/* ── Content Panel sub-component ────────────────── */

type ContentPanelProps = {
  activeSection: SectionId;
  entries: PlanEntryInfo[];
  gitFiles: GitFileEntry[];
  specs: SpecInfo[];
  services: ServiceProcess[];
  servicesAvailable: boolean;
};

const sectionNames: Record<SectionId, string> = {
  services: "Services",
  specs: "Specs",
  tasks: "Tasks",
  files: "Files",
};

function ContentPanel({ activeSection, entries, gitFiles, specs, services, servicesAvailable }: ContentPanelProps) {
  return (
    <div className="content-panel">
      <div className="content-panel__header">{sectionNames[activeSection]}</div>
      <div className="content-panel__body" key={activeSection}>
        {activeSection === "services" && (
          <div className="workspace__services">
            {servicesAvailable ? (
              services.map((service) => (
                <ServiceRow key={service.name} service={service} />
              ))
            ) : (
              <div className="workspace__services-unavailable">unavailable</div>
            )}
          </div>
        )}
        {activeSection === "specs" && (
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
        {activeSection === "tasks" && (
          <div className="workspace__entries">
            {entries.map((entry, i) => (
              <PlanEntry key={i} entry={entry} />
            ))}
          </div>
        )}
        {activeSection === "files" && (
          <div className="workspace__files">
            {sortedGitFiles(gitFiles).map((file) => (
              <GitFileRow key={file.path} file={file} displayStatus={effectiveStatus(file)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Workspace component ────────────────────────── */

export function Workspace({
  entries,
  gitFiles,
  specs,
  services,
  servicesAvailable,
}: WorkspaceProps) {
  const hasEntries = entries.length > 0;
  const hasFiles = gitFiles.length > 0;
  const hasSpecs = specs.length > 0;
  const hasServices = services.length > 0 || !servicesAvailable;
  const hasContent = hasEntries || hasFiles || hasSpecs || hasServices;

  const [activeSection, setActiveSection] = useState<SectionId | null>(null);

  // Track whether auto-select has fired so manual selections aren't overridden
  const autoSelectedRef = useRef(false);

  // Auto-select first section to receive content
  useEffect(() => {
    if (autoSelectedRef.current) return;
    if (hasServices) {
      setActiveSection("services");
      autoSelectedRef.current = true;
    } else if (hasEntries) {
      setActiveSection("tasks");
      autoSelectedRef.current = true;
    } else if (hasFiles) {
      setActiveSection("files");
      autoSelectedRef.current = true;
    } else if (hasSpecs) {
      setActiveSection("specs");
      autoSelectedRef.current = true;
    }
  }, [hasServices, hasEntries, hasFiles, hasSpecs]);

  // If tasks arrive after another section was auto-selected, switch to tasks
  const prevHasEntries = useRef(hasEntries);
  useEffect(() => {
    if (!prevHasEntries.current && hasEntries) {
      setActiveSection("tasks");
    }
    prevHasEntries.current = hasEntries;
  }, [hasEntries]);

  // Clicking already-active icon is idempotent (no toggle-to-close)
  const handleSelect = (section: SectionId) => {
    setActiveSection(section);
  };

  if (!hasContent) {
    return (
      <div className="workspace">
        <div className="workspace__empty">
          Tasks and file changes will appear here.
        </div>
      </div>
    );
  }

  return (
    <div className="workspace">
      <IconBar
        activeSection={activeSection}
        onSelect={handleSelect}
        hasServices={hasServices}
        hasSpecs={hasSpecs}
        hasEntries={hasEntries}
        hasFiles={hasFiles}
      />
      {activeSection && (
        <ContentPanel
          activeSection={activeSection}
          entries={entries}
          gitFiles={gitFiles}
          specs={specs}
          services={services}
          servicesAvailable={servicesAvailable}
        />
      )}
    </div>
  );
}
