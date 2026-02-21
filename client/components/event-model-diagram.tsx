import React from "react";
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

export function EventModelDiagram({ slices }: { slices: EventModelSlice[] }) {
  return (
    <div className="em-diagram">
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
    </div>
  );
}
