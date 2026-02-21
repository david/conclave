# Event Model Component — Implementation Plan

Renders `conclave:eventmodel` JSON blocks as vertical event model diagrams in the chat pane. Follows the same integration pattern as `conclave:usecase` — a new branch in the `<pre>` override in `markdown-text.tsx` that delegates to a new `EventModelDiagram` component.

## New Types

**File:** modify `client/types.ts`

Add TypeScript types for the `conclave:eventmodel` JSON schema. These types are consumed by the diagram component for type-safe rendering.

```ts
export type EventModelNodeFields = Record<string, string>;

export type EventModelCommand = {
  name: string;
  new?: boolean;
  fields?: EventModelNodeFields;
  feeds?: string[];
};

export type EventModelEvent = {
  name: string;
  new?: boolean;
  fields?: EventModelNodeFields;
  feeds?: string[];
};

export type EventModelProjection = {
  name: string;
  new?: boolean;
  fields?: EventModelNodeFields;
  feeds?: string[];
};

export type EventModelSlice = {
  slice: string;
  label?: string;
  screen?: string;
  command?: EventModelCommand;
  events?: EventModelEvent[];
  projections?: EventModelProjection[];
  sideEffects?: string[];
};
```

**Steps:**
1. Read `client/types.ts`
2. Add the types above after the `UseCase` type definition
3. Verify `bun run check` passes

**Tests:** Type-only — verified by `bun run check`.

---

## UC-1: View event model diagram in chat

Render each `conclave:eventmodel` block as a slice column in a visual diagram. Multiple blocks in the same message form a multi-column diagram with aligned tier rows.

### Markdown integration

**File:** modify `client/components/markdown-text.tsx`

The `<pre>` override in the `components` object needs a new branch for `conclave:eventmodel`. Unlike `conclave:usecase` which renders cards inline immediately, eventmodel blocks must be **collected** across the entire message and rendered as a single multi-column diagram after all blocks are parsed.

**Approach — collection via wrapper component:**

Because `react-markdown` renders each fenced code block independently through the `<pre>` override, individual blocks cannot see each other. Use this strategy:

1. Each `conclave:eventmodel` block renders an `<EventModelSliceData>` component that is visually hidden but registers its parsed slice data into a React context.
2. A `<EventModelDiagramRenderer>` wrapper around the `ReactMarkdown` output reads all registered slices from context and renders the unified diagram at the bottom of the message.

However, this adds complexity. A simpler approach: since the `MarkdownText` component receives the full `text` prop, **extract all `conclave:eventmodel` blocks from the raw markdown text** before rendering, parse them, and render the diagram separately — while still letting the individual `<pre>` overrides return `null` for those blocks so they don't render as code.

**Simpler approach chosen:**

1. In `MarkdownText`, before rendering `ReactMarkdown`, extract all `conclave:eventmodel` JSON blocks from the raw `text` using a regex: `` /```conclave:eventmodel\n([\s\S]*?)```/g ``
2. Parse each match into an `EventModelSlice`. Collect valid slices into an array.
3. If slices were found, render an `<EventModelDiagram slices={validSlices} />` component **after** the `ReactMarkdown` output.
4. In the `<pre>` override, when `language === "conclave:eventmodel"`, return `null` (suppress the raw JSON).

**Steps:**
1. Read `client/components/markdown-text.tsx`
2. Import the new `EventModelDiagram` component and `EventModelSlice` type
3. In the `MarkdownText` function, add slice extraction logic before the return
4. Add `conclave:eventmodel` branch to the `pre` component that returns `null`
5. Render `<EventModelDiagram>` after the `<ReactMarkdown>` output when slices exist

### Diagram component

**File:** create `client/components/event-model-diagram.tsx`

A React component that takes `slices: EventModelSlice[]` and renders a multi-column diagram with aligned tier rows.

**Layout structure:**
```
<div class="em-diagram">                          ← horizontal scroll container
  <div class="em-diagram__tiers">                  ← tier row labels (left gutter)
    <div class="em-diagram__tier-label">Screen</div>
    <div class="em-diagram__tier-label">Command</div>
    <div class="em-diagram__tier-label">Events</div>
    <div class="em-diagram__tier-label">Projections</div>
    <div class="em-diagram__tier-label">Side Effects</div>
  </div>
  <div class="em-diagram__slices">                 ← slice columns
    <div class="em-diagram__slice">                ← one per slice
      <div class="em-diagram__slice-header">Fill Inputs</div>
      <div class="em-diagram__tier">               ← screen tier
        <div class="em-diagram__node em-diagram__node--screen">Input Form</div>
      </div>
      <div class="em-diagram__tier">               ← command tier
        <div class="em-diagram__node em-diagram__node--command">FillInputs</div>
      </div>
      <div class="em-diagram__tier">               ← events tier
        <div class="em-diagram__node em-diagram__node--event">InputFilled</div>
      </div>
      ... more tiers ...
    </div>
  </div>
</div>
```

**Tier order** (fixed, top to bottom): screen, command, events, projections, side effects.

**Nodes:**
- Each node shows its name in the center
- Nodes with `new: true` get a subtle "new" indicator (small dot or badge)
- Nodes with `fields` get a cursor pointer and are expandable (see UC-3)
- Empty tiers render as blank cells to maintain grid alignment

**Within-slice arrows:**
- CSS-only downward arrows between adjacent populated tiers within a slice
- Use `::after` pseudo-elements on tier cells to draw vertical connector lines + arrowheads
- Only draw between tiers that both have content

**Steps:**
1. Create `client/components/event-model-diagram.tsx`
2. Define the component accepting `{ slices: EventModelSlice[] }`
3. Implement the grid layout with tier labels and slice columns
4. Render nodes in their tier positions with tier-specific CSS classes
5. Implement within-slice arrows using CSS pseudo-elements between populated tiers
6. Handle empty tiers as blank spacer cells

### Styles

**File:** modify `client/style.css`

Add CSS for the event model diagram. Use BEM naming under `.em-diagram` prefix. Follow event storming color conventions.

**Node colors:**
- Screen: `var(--text-secondary)` on transparent (neutral)
- Command: `#5b9fd4` (blue) on `rgba(91, 159, 212, 0.12)` — matches existing dep-id blue
- Event: `var(--accent)` (orange/amber) on `rgba(212, 148, 76, 0.1)`
- Projection: `var(--text-muted)` (gray) on `var(--bg-elevated)`
- Side Effect: `var(--success)` (green) on `var(--success-dim)`

**New indicator:** Nodes with `new: true` get a small filled circle (4px) in the top-right corner, colored to match the node's tier color.

**Steps:**
1. Read `client/style.css`
2. Add `.em-diagram` section after the Use Case Cards section
3. Style the grid layout: `.em-diagram` uses `display: flex` with tier labels as a fixed-width gutter and slices scrolling horizontally
4. Style tier rows with consistent height to align across columns
5. Style nodes with tier-specific colors, border-radius, and padding
6. Style within-slice arrows (vertical connectors between populated tiers)
7. Style the "new" indicator dot
8. Style slice headers

**Tests:**
- Render a single slice with all tiers populated — verify all five tier nodes appear
- Render a single slice with only events and projections — verify empty tiers are blank, arrows connect only populated tiers
- Render multiple slices — verify they appear as side-by-side columns with aligned tier rows
- Render a slice with `label` — verify the label appears in the column header
- Render a slice without `label` — verify the `slice` (kebab-case) id is used as fallback

---

## UC-2: Trace cross-slice relationships

When a node has `feeds` referencing a node name in another slice, draw a cross-slice arrow.

**File:** modify `client/components/event-model-diagram.tsx`

**Approach:** Use SVG overlay for cross-slice arrows. The diagram component renders an `<svg>` overlay positioned absolutely over the grid. After mount, use `useEffect` + `useRef` to measure node positions via `getBoundingClientRect` and draw path elements between source and target nodes.

**Arrow resolution:**
1. Build a lookup map: `nodeName → { sliceIndex, tier, element }` for all rendered nodes
2. For each node with `feeds`, look up each target name in the map
3. If found, draw an SVG path from the source node to the target node
4. If not found, silently ignore (per the epic's "unresolved references are silently ignored" decision)

**Arrow styling:**
- Dashed stroke (distinguishes from within-slice solid arrows)
- Color: `var(--text-muted)` with some opacity
- Small arrowhead marker at the target end

**Steps:**
1. Add `useRef` and `useEffect` to the diagram component
2. Assign `data-node-name` and `data-slice-index` attributes to each rendered node
3. After mount, collect all `feeds` references and resolve target nodes by name
4. For each resolved pair, compute positions relative to the SVG overlay
5. Render SVG `<path>` elements with dashed stroke and arrowhead markers
6. Re-compute on window resize using a `ResizeObserver`

**Tests:**
- Render two slices where slice A's event feeds slice B's projection — verify an SVG path is drawn connecting them
- Render a slice with a `feeds` reference to a nonexistent node — verify no error, no arrow
- Render three slices with multiple cross-slice feeds — verify all arrows render correctly

---

## UC-3: Inspect node fields

Clicking a node with `fields` expands it to show key:type pairs.

**File:** modify `client/components/event-model-diagram.tsx`

**Approach:** Track expanded node state using `useState<Set<string>>` where the key is `${sliceIndex}-${tier}-${nodeIndex}`. On click, toggle the node's expanded state. When expanded, render the fields as a list below the node name.

**Steps:**
1. Add `useState<Set<string>>` for expanded nodes
2. On nodes with `fields`, add `onClick` handler and `cursor: pointer` style
3. When expanded, render a `.em-diagram__fields` container below the node name
4. Each field renders as `<span class="em-diagram__field-key">key</span>: <span class="em-diagram__field-type">type</span>`
5. Animate expansion with CSS

**Styles** (in `client/style.css`):
- `.em-diagram__node--expandable` — `cursor: pointer` on hover
- `.em-diagram__fields` — smaller font, muted colors, padding below node name
- `.em-diagram__field-key` — mono font, accent color
- `.em-diagram__field-type` — mono font, muted color

**Tests:**
- Render a node with fields, simulate click — verify fields appear
- Click again — verify fields collapse
- Render a node without fields — verify it is not clickable (no cursor change, no expansion)

---

## UC-4: Graceful fallback for invalid blocks

Invalid `conclave:eventmodel` blocks render as standard code blocks.

**File:** modify `client/components/markdown-text.tsx`

This is handled by the extraction logic in UC-1:
- The regex extraction in `MarkdownText` wraps each `JSON.parse` in a try/catch
- Invalid JSON is skipped (not added to the valid slices array)
- Valid slices missing the required `slice` field are also skipped
- The `<pre>` override checks: if the block's JSON is invalid or wasn't parsed successfully, fall through to the default code block rendering instead of returning `null`

**Approach refinement:**

1. The `<pre>` override for `conclave:eventmodel` attempts `JSON.parse` and validates `slice` field
2. If valid: return `null` (the diagram handles it)
3. If invalid: fall through to render as a standard code block with copy button

This means parsing happens twice (once in `MarkdownText` for collection, once in `<pre>` for fallback decision), but the parse is cheap and this keeps the logic simple and self-contained.

**Steps:**
1. In the `<pre>` override's `conclave:eventmodel` branch, parse the JSON
2. If parse succeeds and `result.slice` exists, return `null`
3. If parse fails or `slice` is missing, fall through to the default code block rendering

**Tests:**
- Render a message with invalid JSON in a `conclave:eventmodel` block — verify it appears as a standard code block with language label and copy button
- Render a message with valid JSON missing the `slice` field — verify same fallback
- Render a message with one valid and one invalid block — verify the valid one renders as a diagram and the invalid one renders as a code block
- Render a message with no `conclave:eventmodel` blocks — verify normal markdown rendering is unaffected

---

## Documentation

**File:** modify `doc/components.md`

Add a `## conclave:eventmodel` section documenting the schema, rendering behavior, and examples. Follow the same format as the existing `conclave:usecase` section.

**Steps:**
1. Read `doc/components.md`
2. Add `## conclave:eventmodel` section after `conclave:usecase`
3. Include the schema table from the epic's analysis.md
4. Document rendering behavior: multi-column diagram, tier alignment, within-slice arrows, cross-slice feeds arrows, expandable fields, fallback
5. Include an example block
