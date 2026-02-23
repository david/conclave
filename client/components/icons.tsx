import React from "react";

/**
 * Pure SVG icons — no Unicode glyphs, so they render
 * consistently regardless of which font is active.
 */

type IconProps = {
  size?: number;
  className?: string;
};

/* ── Status dot ─────────────────────────────────── */

export function StatusDot({
  status,
  size = 8,
  className,
}: IconProps & { status: string }) {
  return (
    <span className={`status-dot ${className ?? ""}`} data-status={status}>
      <svg width={size} height={size} viewBox="0 0 8 8">
        {status === "pending" ? (
          <circle cx="4" cy="4" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
        ) : (
          <circle cx="4" cy="4" r="4" fill="currentColor" />
        )}
      </svg>
    </span>
  );
}

/* ── Chevron toggle (expand / collapse) ─────────── */

export function Chevron({
  expanded,
  className,
}: IconProps & { expanded: boolean }) {
  return (
    <span className={`chevron ${className ?? ""}`}>
      <svg
        width="10"
        height="10"
        viewBox="0 0 10 10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          transition: "transform 0.2s",
          transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
        }}
      >
        <polyline points="3,1.5 7,5 3,8.5" />
      </svg>
    </span>
  );
}

/* ── File action icons ──────────────────────────── */

export function FileActionIcon({
  action,
  size = 14,
  className,
}: IconProps & { action: string }) {
  return (
    <span className={`file-icon file-icon--${action} ${className ?? ""}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 14 14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Base file shape */}
        <path d="M3,1.5 L9,1.5 L11.5,4 L11.5,12.5 L3,12.5 Z" />
        <polyline points="9,1.5 9,4 11.5,4" />
        {action === "modified" && (
          <line x1="5.5" y1="8" x2="9" y2="8" />
        )}
        {action === "deleted" && (
          <line x1="5.5" y1="8.25" x2="8.75" y2="8.25" />
        )}
      </svg>
    </span>
  );
}

/* ── Git status icons (for file change entries) ─── */

export function GitStatusIcon({
  status,
  size = 14,
  className,
}: IconProps & { status: string }) {
  const colorMap: Record<string, string> = {
    M: "var(--warning)",
    A: "var(--success)",
    D: "var(--error)",
    R: "var(--accent)",
    "?": "var(--text-muted)",
  };
  const color = colorMap[status] ?? "var(--text-muted)";

  return (
    <span
      className={`git-status-icon ${className ?? ""}`}
      data-status={status}
      style={{ color }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 14 14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {status === "M" ? (
          /* pencil / edit */
          <>
            <path d="M8.5,2.5 L11.5,5.5 L5,12 L2,12 L2,9 Z" />
            <line x1="7" y1="4" x2="10" y2="7" />
          </>
        ) : status === "A" ? (
          /* plus */
          <>
            <line x1="7" y1="3" x2="7" y2="11" />
            <line x1="3" y1="7" x2="11" y2="7" />
          </>
        ) : status === "D" ? (
          /* minus */
          <line x1="3" y1="7" x2="11" y2="7" />
        ) : status === "R" ? (
          /* right arrow */
          <>
            <line x1="2" y1="7" x2="12" y2="7" />
            <polyline points="8,3.5 12,7 8,10.5" />
          </>
        ) : status === "?" ? (
          /* question mark */
          <>
            <path d="M5,5 Q5,3 7,3 Q9,3 9,5 Q9,6.5 7,7 L7,8" />
            <circle cx="7" cy="10.5" r="0.5" fill="currentColor" stroke="none" />
          </>
        ) : (
          /* default: empty circle */
          <circle cx="7" cy="7" r="5" fill="none" />
        )}
      </svg>
    </span>
  );
}

/* ── Service status icons ───────────────────────── */

export function ServiceStatusIcon({
  status,
  size = 8,
  className,
}: IconProps & { status: string }) {
  const colorMap: Record<string, string> = {
    Running: "var(--success)",
    Completed: "var(--text-muted)",
    Skipped: "var(--text-muted)",
    Launching: "var(--warning)",
    Restarting: "var(--warning)",
  };
  const color = colorMap[status] ?? "var(--error)";

  return (
    <span className={`service-status-dot ${className ?? ""}`} style={{ color }}>
      <svg width={size} height={size} viewBox="0 0 8 8">
        <circle cx="4" cy="4" r="4" fill="currentColor" />
      </svg>
    </span>
  );
}

/* ── Section icons (workspace icon bar) ─────────── */

export function ServicesIcon({ size = 20, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Three stacked horizontal bars (server/process) */}
      <line x1="4" y1="5" x2="16" y2="5" />
      <line x1="4" y1="10" x2="16" y2="10" />
      <line x1="4" y1="15" x2="16" y2="15" />
      <circle cx="15" cy="5" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="10" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="15" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function SpecsIcon({ size = 20, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Document with lines */}
      <path d="M5,2 L12,2 L15,5 L15,18 L5,18 Z" />
      <polyline points="12,2 12,5 15,5" />
      <line x1="7.5" y1="9" x2="12.5" y2="9" />
      <line x1="7.5" y1="12" x2="12.5" y2="12" />
      <line x1="7.5" y1="15" x2="10.5" y2="15" />
    </svg>
  );
}

export function TasksIcon({ size = 20, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Checkbox / checklist */}
      <rect x="3" y="3" width="5" height="5" rx="1" />
      <polyline points="4.5,5.5 6,7 8.5,3.5" />
      <line x1="11" y1="5.5" x2="17" y2="5.5" />
      <rect x="3" y="12" width="5" height="5" rx="1" />
      <line x1="11" y1="14.5" x2="17" y2="14.5" />
    </svg>
  );
}

export function FilesIcon({ size = 20, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Branching tree (git/file-diff) */}
      <circle cx="6" cy="4" r="2" />
      <circle cx="6" cy="16" r="2" />
      <circle cx="14" cy="8" r="2" />
      <line x1="6" y1="6" x2="6" y2="14" />
      <path d="M6,8 Q6,10 8,10 L12,10 Q14,10 14,8" />
    </svg>
  );
}

/* ── Task status icons (for plan entries) ───────── */

export function TaskIcon({
  status,
  size = 14,
  className,
}: IconProps & { status: string }) {
  return (
    <span className={`task-icon ${className ?? ""}`} data-status={status}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 14 14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {status === "completed" ? (
          /* checkmark */
          <polyline points="3,7.5 6,10.5 11,4" />
        ) : status === "in_progress" ? (
          /* right-pointing triangle (play) */
          <polygon points="4,2.5 4,11.5 11.5,7" fill="currentColor" stroke="none" />
        ) : (
          /* empty circle */
          <circle cx="7" cy="7" r="5" fill="none" />
        )}
      </svg>
    </span>
  );
}
