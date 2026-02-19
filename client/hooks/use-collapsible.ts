import { useState, useCallback, useMemo } from "react";
import type { HTMLAttributes } from "react";

type CollapsibleHeaderProps = Pick<
  HTMLAttributes<HTMLElement>,
  "onClick" | "onKeyDown" | "role" | "tabIndex"
>;

/**
 * Hook for expand/collapse interaction on a header element.
 * When `enabled` is false, the header is not interactive and `expanded` stays false.
 */
export function useCollapsible(enabled = true) {
  const [expanded, setExpanded] = useState(false);

  const toggle = useCallback(() => {
    if (enabled) setExpanded((prev) => !prev);
  }, [enabled]);

  const headerProps: CollapsibleHeaderProps = useMemo(
    () =>
      enabled
        ? {
            onClick: toggle,
            role: "button" as const,
            tabIndex: 0,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") toggle();
            },
          }
        : {},
    [enabled, toggle],
  );

  return { expanded: enabled && expanded, toggle, headerProps };
}
