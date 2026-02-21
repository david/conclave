import React, { useRef, useEffect, useState, useCallback } from "react";
import type { EventModelSlice } from "../types.ts";

type TierData = {
  nodes: { name: string; isNew: boolean; fields?: Record<string, string> }[];
};

function buildTiers(slice: EventModelSlice): TierData[] {
  const screen: TierData = {
    nodes: slice.screen ? [{ name: slice.screen, isNew: false }] : [],
  };
  const command: TierData = {
    nodes: slice.command ? [{ name: slice.command.name, isNew: !!slice.command.new, fields: slice.command.fields }] : [],
  };
  const events: TierData = {
    nodes: (slice.events ?? []).map((e) => ({ name: e.name, isNew: !!e.new, fields: e.fields })),
  };
  const projections: TierData = {
    nodes: (slice.projections ?? []).map((p) => ({ name: p.name, isNew: !!p.new, fields: p.fields })),
  };
  const sideEffects: TierData = {
    nodes: (slice.sideEffects ?? []).map((s) => ({ name: s, isNew: false })),
  };

  return [screen, command, events, projections, sideEffects];
}

const TIER_MODIFIERS = ["screen", "command", "event", "projection", "side-effect"] as const;

function hasFields(fields?: Record<string, string>): fields is Record<string, string> {
  return !!fields && Object.keys(fields).length > 0;
}

type SliceColumnProps = {
  slice: EventModelSlice;
  sliceIndex: number;
  expandedNodes: Set<string>;
  onToggleNode: (key: string) => void;
};

function SliceColumn({ slice, sliceIndex, expandedNodes, onToggleNode }: SliceColumnProps) {
  const tiers = buildTiers(slice);
  const header = slice.label || slice.slice;

  const elements: React.ReactNode[] = [];
  elements.push(
    <div key="header" className="em-diagram__slice-header">
      {header}
    </div>,
  );

  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i];
    const modifier = TIER_MODIFIERS[i];

    // Render arrow before this tier if both this tier and the previous tier are populated
    if (i > 0) {
      const prevTier = tiers[i - 1];
      if (prevTier.nodes.length > 0 && tier.nodes.length > 0) {
        elements.push(
          <div key={`arrow-${i}`} className="em-diagram__arrow" />,
        );
      }
    }

    elements.push(
      <div key={`tier-${i}`} className="em-diagram__tier">
        {tier.nodes.map((node, j) => {
          const expandable = hasFields(node.fields);
          const nodeKey = `${sliceIndex}-${i}-${j}`;
          const expanded = expandable && expandedNodes.has(nodeKey);

          return (
            <div
              key={j}
              data-node-name={node.name}
              className={
                `em-diagram__node em-diagram__node--${modifier}` +
                (node.isNew ? " em-diagram__node--new" : "") +
                (expandable ? " em-diagram__node--expandable" : "")
              }
              onClick={expandable ? () => onToggleNode(nodeKey) : undefined}
            >
              <span className="em-diagram__node-name">{node.name}</span>
              {expanded && (
                <div className="em-diagram__fields">
                  {Object.entries(node.fields!).map(([key, type]) => (
                    <div key={key}>
                      <span className="em-diagram__field-key">{key}</span>
                      <span className="em-diagram__field-sep">:</span>
                      <span className="em-diagram__field-type">{type}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>,
    );
  }

  return <div className="em-diagram__slice">{elements}</div>;
}

type ArrowPath = {
  key: string;
  d: string;
};

function collectFeedsPairs(slices: EventModelSlice[]): { source: string; target: string }[] {
  const pairs: { source: string; target: string }[] = [];
  for (const slice of slices) {
    if (slice.command?.feeds) {
      for (const target of slice.command.feeds) {
        pairs.push({ source: slice.command.name, target });
      }
    }
    for (const event of slice.events ?? []) {
      if (event.feeds) {
        for (const target of event.feeds) {
          pairs.push({ source: event.name, target });
        }
      }
    }
    for (const projection of slice.projections ?? []) {
      if (projection.feeds) {
        for (const target of projection.feeds) {
          pairs.push({ source: projection.name, target });
        }
      }
    }
  }
  return pairs;
}

/**
 * Compute a connection point at the center of the nearest edge of a rectangle.
 * Always returns the exact midpoint of the chosen edge (top/bottom/left/right).
 */
function edgeMidpoint(
  rect: { left: number; top: number; width: number; height: number },
  targetX: number,
  targetY: number,
): { x: number; y: number; edge: "top" | "bottom" | "left" | "right" } {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = targetX - cx;
  const dy = targetY - cy;

  if (dx === 0 && dy === 0) {
    return { x: rect.left + rect.width, y: cy, edge: "right" };
  }

  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  const hw = rect.width / 2;
  const hh = rect.height / 2;

  if (absDx * hh > absDy * hw) {
    if (dx > 0) {
      return { x: rect.left + rect.width, y: cy, edge: "right" };
    } else {
      return { x: rect.left, y: cy, edge: "left" };
    }
  } else {
    if (dy > 0) {
      return { x: cx, y: rect.top + rect.height, edge: "bottom" };
    } else {
      return { x: cx, y: rect.top, edge: "top" };
    }
  }
}

export function EventModelDiagram({ slices }: { slices: EventModelSlice[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [arrows, setArrows] = useState<ArrowPath[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const handleToggleNode = useCallback((key: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const computeArrows = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const pairs = collectFeedsPairs(slices);
    if (pairs.length === 0) {
      setArrows([]);
      return;
    }

    const nodeElements = container.querySelectorAll<HTMLElement>("[data-node-name]");
    const nodeMap = new Map<string, HTMLElement>();
    for (const el of nodeElements) {
      const name = el.getAttribute("data-node-name");
      if (name) nodeMap.set(name, el);
    }

    const containerRect = container.getBoundingClientRect();
    const newArrows: ArrowPath[] = [];

    for (const { source, target } of pairs) {
      const sourceEl = nodeMap.get(source);
      const targetEl = nodeMap.get(target);
      if (!sourceEl || !targetEl) continue;

      const sourceRect = sourceEl.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();

      const sr = {
        left: sourceRect.left - containerRect.left,
        top: sourceRect.top - containerRect.top,
        width: sourceRect.width,
        height: sourceRect.height,
      };
      const tr = {
        left: targetRect.left - containerRect.left,
        top: targetRect.top - containerRect.top,
        width: targetRect.width,
        height: targetRect.height,
      };

      const targetCx = tr.left + tr.width / 2;
      const targetCy = tr.top + tr.height / 2;
      const sourceCx = sr.left + sr.width / 2;
      const sourceCy = sr.top + sr.height / 2;

      const sp = edgeMidpoint(sr, targetCx, targetCy);
      const tp = edgeMidpoint(tr, sourceCx, sourceCy);

      // Cubic bezier with control points extending outward from each edge
      const dx = tp.x - sp.x;
      const dy = tp.y - sp.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const cpOffset = Math.max(40, dist * 0.35);

      let cp1x: number, cp1y: number;
      if (sp.edge === "left" || sp.edge === "right") {
        cp1x = sp.x + (sp.edge === "right" ? cpOffset : -cpOffset);
        cp1y = sp.y;
      } else {
        cp1x = sp.x;
        cp1y = sp.y + (sp.edge === "bottom" ? cpOffset : -cpOffset);
      }

      let cp2x: number, cp2y: number;
      if (tp.edge === "left" || tp.edge === "right") {
        cp2x = tp.x + (tp.edge === "right" ? cpOffset : -cpOffset);
        cp2y = tp.y;
      } else {
        cp2x = tp.x;
        cp2y = tp.y + (tp.edge === "bottom" ? cpOffset : -cpOffset);
      }

      const d = `M ${sp.x} ${sp.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${tp.x} ${tp.y}`;
      newArrows.push({ key: `${source}->${target}`, d });
    }

    setArrows(newArrows);
  }, [slices]);

  useEffect(() => {
    computeArrows();

    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      computeArrows();
    });
    observer.observe(container);

    return () => observer.disconnect();
  }, [computeArrows]);

  useEffect(() => {
    const timer = setTimeout(computeArrows, 20);
    return () => clearTimeout(timer);
  }, [expandedNodes, computeArrows]);

  return (
    <div className="em-diagram" ref={containerRef}>
      <svg
        className="em-diagram__arrows"
      >
        <defs>
          <marker
            id="em-arrowhead"
            markerWidth="8"
            markerHeight="6"
            refX="8"
            refY="3"
            orient="auto"
          >
            <path d="M 0 0 L 8 3 L 0 6 Z" fill="var(--text-muted)" />
          </marker>
        </defs>
        {arrows.map((arrow) => (
          <path
            key={arrow.key}
            d={arrow.d}
            fill="none"
            stroke="var(--text-muted)"
            strokeDasharray="6 3"
            markerEnd="url(#em-arrowhead)"
          />
        ))}
      </svg>
      <div className="em-diagram__slices">
        {slices.map((slice, i) => (
          <SliceColumn
            key={slice.slice || i}
            slice={slice}
            sliceIndex={i}
            expandedNodes={expandedNodes}
            onToggleNode={handleToggleNode}
          />
        ))}
      </div>
    </div>
  );
}
