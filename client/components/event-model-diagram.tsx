import React, { useRef, useEffect, useState, useCallback } from "react";
import type { EventModelSlice } from "../types.ts";

const TIER_LABELS = ["Screen", "Command", "Events", "Projections", "Side Effects"] as const;

type TierData = {
  nodes: { name: string; isNew: boolean }[];
};

function buildTiers(slice: EventModelSlice): TierData[] {
  const screen: TierData = {
    nodes: slice.screen ? [{ name: slice.screen, isNew: false }] : [],
  };
  const command: TierData = {
    nodes: slice.command ? [{ name: slice.command.name, isNew: !!slice.command.new }] : [],
  };
  const events: TierData = {
    nodes: (slice.events ?? []).map((e) => ({ name: e.name, isNew: !!e.new })),
  };
  const projections: TierData = {
    nodes: (slice.projections ?? []).map((p) => ({ name: p.name, isNew: !!p.new })),
  };
  const sideEffects: TierData = {
    nodes: (slice.sideEffects ?? []).map((s) => ({ name: s, isNew: false })),
  };

  return [screen, command, events, projections, sideEffects];
}

const TIER_MODIFIERS = ["screen", "command", "event", "projection", "side-effect"] as const;

function SliceColumn({ slice }: { slice: EventModelSlice }) {
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
        {tier.nodes.map((node, j) => (
          <div
            key={j}
            data-node-name={node.name}
            className={
              `em-diagram__node em-diagram__node--${modifier}` +
              (node.isNew ? " em-diagram__node--new" : "")
            }
          >
            {node.name}
          </div>
        ))}
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

export function EventModelDiagram({ slices }: { slices: EventModelSlice[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [arrows, setArrows] = useState<ArrowPath[]>([]);

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

      const sx = sourceRect.left + sourceRect.width / 2 - containerRect.left;
      const sy = sourceRect.top + sourceRect.height / 2 - containerRect.top;
      const tx = targetRect.left + targetRect.width / 2 - containerRect.left;
      const ty = targetRect.top + targetRect.height / 2 - containerRect.top;

      const cpOffset = Math.abs(tx - sx) * 0.3;

      const d = `M ${sx} ${sy} C ${sx + cpOffset} ${sy}, ${tx - cpOffset} ${ty}, ${tx} ${ty}`;
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

  return (
    <div className="em-diagram" ref={containerRef} style={{ position: "relative" }}>
      <div className="em-diagram__tiers">
        {TIER_LABELS.map((label) => (
          <div key={label} className="em-diagram__tier-label">
            {label}
          </div>
        ))}
      </div>
      <div className="em-diagram__slices">
        {slices.map((slice, i) => (
          <SliceColumn key={slice.slice || i} slice={slice} />
        ))}
      </div>
      <svg
        className="em-diagram__arrows"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          overflow: "visible",
        }}
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
    </div>
  );
}
