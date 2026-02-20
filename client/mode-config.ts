import type { ModeClientInfo } from "../server/types.ts";

/** Map color names from mode frontmatter to CSS custom property names. */
const COLOR_VAR_MAP: Record<string, string> = {
  blue: "--mode-blue",
  purple: "--mode-purple",
  green: "--mode-green",
  red: "--mode-red",
  amber: "--mode-amber",
  neutral: "--mode-neutral",
};

/** Resolve a mode's color name to a CSS variable reference. */
export function modeColorVar(color: string): string {
  const varName = COLOR_VAR_MAP[color] ?? "--mode-neutral";
  return `var(${varName})`;
}

export function modeColorDimVar(color: string): string {
  const varName = COLOR_VAR_MAP[color] ?? "--mode-neutral";
  return `var(${varName}-dim)`;
}

const FALLBACK_MODE: ModeClientInfo = {
  id: "chat",
  label: "Chat",
  color: "neutral",
  icon: "chat",
  placeholder: "Type a message...",
};

/** Look up a mode by ID, with fallback. */
export function getModeInfo(modes: ModeClientInfo[], id: string): ModeClientInfo {
  return modes.find((m) => m.id === id) ?? FALLBACK_MODE;
}
