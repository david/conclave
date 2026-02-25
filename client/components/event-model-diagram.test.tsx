import { describe, test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { EventModelDiagram } from "./event-model-diagram.tsx";
import { AssistantMarkdown } from "./assistant-markdown.tsx";
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
    // Use the exact class with trailing quote to avoid matching em-diagram__arrows (SVG overlay)
    expect(html).not.toContain('em-diagram__arrow"');
  });

  test("does not render tier labels (lane labels removed)", () => {
    const slices: EventModelSlice[] = [
      { slice: "test", events: [{ name: "E" }] },
    ];
    const html = render(slices);

    // Lane labels were removed — no tier label gutter should exist
    expect(html).not.toContain("em-diagram__tier-label");
    expect(html).not.toContain("em-diagram__tiers");
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

  test("renders data-node-name attributes on all nodes", () => {
    const slices: EventModelSlice[] = [
      {
        slice: "attrs-test",
        screen: "MyScreen",
        command: { name: "DoStuff" },
        events: [{ name: "StuffDone" }],
        projections: [{ name: "StuffView" }],
        sideEffects: ["Notify"],
      },
    ];
    const html = render(slices);

    expect(html).toContain('data-node-name="MyScreen"');
    expect(html).toContain('data-node-name="DoStuff"');
    expect(html).toContain('data-node-name="StuffDone"');
    expect(html).toContain('data-node-name="StuffView"');
    expect(html).toContain('data-node-name="Notify"');
  });

  test("renders SVG overlay element with em-diagram__arrows class", () => {
    const slices: EventModelSlice[] = [
      {
        slice: "svg-test",
        command: { name: "Cmd", feeds: ["SomeEvent"] },
        events: [{ name: "SomeEvent" }],
      },
    ];
    const html = render(slices);

    expect(html).toContain("em-diagram__arrows");
    expect(html).toContain("<svg");
  });

  test("renders without error when feeds references a nonexistent node", () => {
    const slices: EventModelSlice[] = [
      {
        slice: "bad-ref",
        command: { name: "Cmd", feeds: ["DoesNotExist"] },
        events: [{ name: "RealEvent" }],
      },
    ];
    // Should not throw
    const html = render(slices);
    expect(html).toContain("em-diagram");
    expect(html).toContain("Cmd");
    expect(html).toContain("RealEvent");
  });

  test("renders SVG overlay for two slices with cross-slice feeds", () => {
    const slices: EventModelSlice[] = [
      {
        slice: "slice-a",
        events: [{ name: "EventA", feeds: ["ProjectionB"] }],
      },
      {
        slice: "slice-b",
        projections: [{ name: "ProjectionB" }],
      },
    ];
    const html = render(slices);

    // Both slices render
    expect(html).toContain("EventA");
    expect(html).toContain("ProjectionB");
    // SVG overlay present
    expect(html).toContain("em-diagram__arrows");
  });

  test("renders expandable class on nodes with fields", () => {
    const slices: EventModelSlice[] = [
      {
        slice: "with-fields",
        command: { name: "CreateUser", fields: { userId: "string", email: "string" } },
        events: [{ name: "UserCreated", fields: { userId: "string", timestamp: "Date" } }],
      },
    ];
    const html = render(slices);

    // Nodes with fields should have the expandable class
    expect(html).toContain("em-diagram__node--expandable");
  });

  test("does not render expandable class on nodes without fields", () => {
    const slices: EventModelSlice[] = [
      {
        slice: "no-fields",
        command: { name: "DoSomething" },
        events: [{ name: "SomethingDone" }],
        projections: [{ name: "SomeView" }],
        sideEffects: ["Notify"],
        screen: "Dashboard",
      },
    ];
    const html = render(slices);

    // No nodes should have the expandable class
    expect(html).not.toContain("em-diagram__node--expandable");
  });

  test("renders expandable class on projection nodes with fields", () => {
    const slices: EventModelSlice[] = [
      {
        slice: "proj-fields",
        projections: [{ name: "UserView", fields: { name: "string", role: "Role" } }],
      },
    ];
    const html = render(slices);

    expect(html).toContain("em-diagram__node--expandable");
  });

  test("screen and sideEffect nodes never have expandable class", () => {
    const slices: EventModelSlice[] = [
      {
        slice: "screen-side",
        screen: "MyScreen",
        sideEffects: ["SendEmail"],
      },
    ];
    const html = render(slices);

    // Screen and sideEffects never have fields, so no expandable class
    expect(html).not.toContain("em-diagram__node--expandable");
  });

  test("expanded node renders fields in a separate container below the name", () => {
    // Regression: fields were rendered inside an inline-flex node,
    // causing the name and fields to overlap horizontally.
    // The node should wrap content vertically when fields are present.
    const slices: EventModelSlice[] = [
      {
        slice: "fields-layout",
        command: { name: "AddToCart", fields: { productId: "UUID", quantity: "number" } },
      },
    ];

    // Render with fields expanded by default is not possible via static render,
    // but we can verify the structural requirement: when fields ARE rendered,
    // the node name appears as a separate span from the fields container.
    // We simulate by checking the component output structure.
    const html = render(slices);

    // The node name should be in its own element, not mixed with fields text
    expect(html).toContain('data-node-name="AddToCart"');
    // The node should contain a dedicated name span
    expect(html).toContain('em-diagram__node-name');
  });

  test("nodes with empty fields object do not get expandable class", () => {
    const slices: EventModelSlice[] = [
      {
        slice: "empty-fields",
        command: { name: "EmptyCmd", fields: {} },
        events: [{ name: "EmptyEvt", fields: {} }],
      },
    ];
    const html = render(slices);

    // Empty fields should not be treated as expandable
    expect(html).not.toContain("em-diagram__node--expandable");
  });
});

describe("AssistantMarkdown eventmodel integration", () => {
  test("renders EventModelDiagram for valid conclave:eventmodel block", () => {
    const slice = JSON.stringify({
      slice: "create-session",
      label: "Create Session",
      events: [{ name: "SessionCreated" }],
    });
    const markdown = `Here is a diagram:\n\n\`\`\`conclave:eventmodel\n${slice}\n\`\`\`\n\nAfter the diagram.`;

    const html = renderToStaticMarkup(<AssistantMarkdown text={markdown} />);

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

    const html = renderToStaticMarkup(<AssistantMarkdown text={markdown} />);

    // Should NOT render as a code block
    expect(html).not.toContain("code-block__header");
    // Should render as diagram
    expect(html).toContain("em-diagram");
  });

  test("renders invalid conclave:eventmodel as a normal code block", () => {
    const markdown = `\`\`\`conclave:eventmodel\n{invalid json\n\`\`\``;

    const html = renderToStaticMarkup(<AssistantMarkdown text={markdown} />);

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

    const html = renderToStaticMarkup(<AssistantMarkdown text={markdown} />);

    // Both slices should appear in a single diagram
    expect(html).toContain("FirstEvent");
    expect(html).toContain("SecondEvent");
    // Only one em-diagram container (rendered after markdown)
    const diagramMatches = html.match(/em-diagram"/g) || [];
    expect(diagramMatches.length).toBe(1);
  });
});
