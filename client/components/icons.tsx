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
    <span className={`status-dot status-dot--${status} ${className ?? ""}`}>
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

/* ── Task status icons (for plan entries) ───────── */

export function TaskIcon({
  status,
  size = 14,
  className,
}: IconProps & { status: string }) {
  return (
    <span className={`task-icon task-icon--${status} ${className ?? ""}`}>
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
