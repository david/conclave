import { describe, test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { EventModelDiagram } from "./event-model-diagram.tsx";
import { MarkdownText } from "./markdown-text.tsx";
import type { EventModelSlice } from "../types.ts";

function render(slices: EventModelSlice[]): string {
  return renderToStaticMarkup(<EventModelDiagram slices={slices} />);
}

describe("EventModelDiagram", () => {
  test("renders a single slice with all tiers populated", () => {
    const slices: EventModelSlice[] = [
      {
        slice: "fill-inputs",
        label: "Fill Inputs",
        screen: "Input Form",
        command: { name: "FillInputs" },
        events: [{ name: "InputsFilled" }],
        projections: [{ name: "InputView" }],
        sideEffects: ["SendEmail"],
      },
    ];
    const html = render(slices);

    // All five tier nodes should appear
    expect(html).toContain("Input Form");
    expect(html).toContain("FillInputs");
    expect(html).toContain("InputsFilled");
    expect(html).toContain("InputView");
    expect(html).toContain("SendEmail");

    // Node type CSS classes present
    expect(html).toContain("em-diagram__node--screen");
    expect(html).toContain("em-diagram__node--command");
    expect(html).toContain("em-diagram__node--event");
    expect(html).toContain("em-diagram__node--projection");
    expect(html).toContain("em-diagram__node--side-effect");
  });

  test("renders empty tiers as blank spacers (no nodes) when only events and projections exist", () => {
    const slices: EventModelSlice[] = [
      {
        slice: "partial",
        events: [{ name: "SomethingHappened" }],
        projections: [{ name: "SomeView" }],
      },
    ];
    const html = render(slices);

    // Events and projections appear
    expect(html).toContain("SomethingHappened");
    expect(html).toContain("SomeView");

    // Screen, command, sideEffects tiers should have no nodes
    expect(html).not.toContain("em-diagram__node--screen");
    expect(html).not.toContain("em-diagram__node--command");
    expect(html).not.toContain("em-diagram__node--side-effect");

    // But tier containers should still exist (5 tiers per slice)
    const tierMatches = html.match(/em-diagram__tier"/g) || [];
    // 5 tiers in the slice
    expect(tierMatches.length).toBeGreaterThanOrEqual(5);
  });

  test("renders multiple slices as separate columns", () => {
    const slices: EventModelSlice[] = [
      { slice: "first", events: [{ name: "FirstEvent" }] },
      { slice: "second", events: [{ name: "SecondEvent" }] },
    ];
    const html = render(slices);

    // Both slices render
    expect(html).toContain("FirstEvent");
    expect(html).toContain("SecondEvent");

    // Multiple slice containers
    const sliceMatches = html.match(/em-diagram__slice"/g) || [];
    expect(sliceMatches.length).toBe(2);
  });

  test("renders label in slice header when label is provided", () => {
    const slices: EventModelSlice[] = [
      { slice: "create-user", label: "Create User", events: [{ name: "UserCreated" }] },
    ];
    const html = render(slices);

    expect(html).toContain("Create User");
  });

  test("falls back to slice id when label is not provided", () => {
    const slices: EventModelSlice[] = [
      { slice: "create-user", events: [{ name: "UserCreated" }] },
    ];
    const html = render(slices);

    // Should use slice id as fallback header
    expect(html).toContain("create-user");
  });

  test("renders new indicator on nodes with new: true", () => {
    const slices: EventModelSlice[] = [
      {
        slice: "new-feature",
        events: [{ name: "NewEvent", new: true }],
        projections: [{ name: "OldProjection" }],
      },
    ];
    const html = render(slices);

    // The new event should have the --new class
    expect(html).toContain("em-diagram__node--new");
  });

  test("renders arrows between adjacent populated tiers", () => {
    const slices: EventModelSlice[] = [
      {
        slice: "with-arrows",
        command: { name: "DoThing" },
        events: [{ name: "ThingDone" }],
      },
    ];
    const html = render(slices);

    // Arrow connector should appear between command and events
    expect(html).toContain("em-diagram__arrow");
  });

  test("does not render arrows between empty adjacent tiers", () => {
    const slices: EventModelSlice[] = [
      {
        slice: "sparse",
        events: [{ name: "OnlyEvent" }],
      },
    ];
    const html = render(slices);

    // No arrows since screen and command are empty, and projections/sideEffects are empty
    // Only events tier is populated - no adjacent populated tier exists
    expect(html).not.toContain("em-diagram__arrow");
  });

  test("renders tier labels in the left gutter", () => {
    const slices: EventModelSlice[] = [
      { slice: "test", events: [{ name: "E" }] },
    ];
    const html = render(slices);

    expect(html).toContain("em-diagram__tier-label");
    expect(html).toContain("Screen");
    expect(html).toContain("Command");
    expect(html).toContain("Events");
    expect(html).toContain("Projections");
    expect(html).toContain("Side Effects");
  });

  test("renders multiple events in a single tier", () => {
    const slices: EventModelSlice[] = [
      {
        slice: "multi-event",
        events: [{ name: "EventA" }, { name: "EventB" }, { name: "EventC" }],
      },
    ];
    const html = render(slices);

    expect(html).toContain("EventA");
    expect(html).toContain("EventB");
    expect(html).toContain("EventC");
  });
});

describe("MarkdownText eventmodel integration", () => {
  test("renders EventModelDiagram for valid conclave:eventmodel block", () => {
    const slice = JSON.stringify({
      slice: "create-session",
      label: "Create Session",
      events: [{ name: "SessionCreated" }],
    });
    const markdown = `Here is a diagram:\n\n\`\`\`conclave:eventmodel\n${slice}\n\`\`\`\n\nAfter the diagram.`;

    const html = renderToStaticMarkup(<MarkdownText text={markdown} />);

    // The diagram should render
    expect(html).toContain("em-diagram");
    expect(html).toContain("SessionCreated");
    expect(html).toContain("Create Session");
  });

  test("suppresses the code block for valid conclave:eventmodel", () => {
    const slice = JSON.stringify({
      slice: "test-slice",
      events: [{ name: "TestEvent" }],
    });
    const markdown = `\`\`\`conclave:eventmodel\n${slice}\n\`\`\``;

    const html = renderToStaticMarkup(<MarkdownText text={markdown} />);

    // Should NOT render as a code block
    expect(html).not.toContain("code-block__header");
    // Should render as diagram
    expect(html).toContain("em-diagram");
  });

  test("renders invalid conclave:eventmodel as a normal code block", () => {
    const markdown = `\`\`\`conclave:eventmodel\n{invalid json\n\`\`\``;

    const html = renderToStaticMarkup(<MarkdownText text={markdown} />);

    // Should render as a normal code block since it's invalid JSON
    expect(html).toContain("code-block");
    // Should NOT render as a diagram
    expect(html).not.toContain("em-diagram");
  });

  test("collects multiple eventmodel blocks into a single diagram", () => {
    const slice1 = JSON.stringify({
      slice: "first",
      events: [{ name: "FirstEvent" }],
    });
    const slice2 = JSON.stringify({
      slice: "second",
      events: [{ name: "SecondEvent" }],
    });
    const markdown = `\`\`\`conclave:eventmodel\n${slice1}\n\`\`\`\n\n\`\`\`conclave:eventmodel\n${slice2}\n\`\`\``;

    const html = renderToStaticMarkup(<MarkdownText text={markdown} />);

    // Both slices should appear in a single diagram
    expect(html).toContain("FirstEvent");
    expect(html).toContain("SecondEvent");
    // Only one em-diagram container (rendered after markdown)
    const diagramMatches = html.match(/em-diagram"/g) || [];
    expect(diagramMatches.length).toBe(1);
  });
});
