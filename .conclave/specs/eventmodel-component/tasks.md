# Event Model Component — Tasks

Six tasks across four waves. Types and docs run first in parallel, then the core diagram, then cross-slice arrows and fallback handling in parallel, and finally field expansion.

## Task Graph

```conclave:tasks
[
  {
    "id": "T-0",
    "name": "Add EventModel types",
    "ucs": [],
    "depends": [],
    "wave": 0,
    "kind": "code",
    "files": {
      "create": [],
      "modify": ["client/types.ts"]
    },
    "description": "Add TypeScript types for the conclave:eventmodel JSON schema to client/types.ts."
  },
  {
    "id": "T-1",
    "name": "Document conclave:eventmodel block",
    "ucs": [],
    "depends": [],
    "wave": 0,
    "kind": "code",
    "files": {
      "create": [],
      "modify": ["doc/components.md"]
    },
    "description": "Add conclave:eventmodel section to doc/components.md with schema, rendering behavior, and examples."
  },
  {
    "id": "T-2",
    "name": "Core diagram component and integration",
    "ucs": ["UC-1"],
    "depends": ["T-0"],
    "wave": 1,
    "kind": "code",
    "files": {
      "create": ["client/components/event-model-diagram.tsx"],
      "modify": ["client/components/markdown-text.tsx", "client/style.css"]
    },
    "description": "Create the EventModelDiagram component with multi-column layout, tier-aligned nodes, within-slice arrows, and node color coding. Wire it into MarkdownText via regex extraction of conclave:eventmodel blocks. Add all base CSS styles."
  },
  {
    "id": "T-3",
    "name": "Cross-slice feed arrows",
    "ucs": ["UC-2"],
    "depends": ["T-2"],
    "wave": 2,
    "kind": "code",
    "files": {
      "create": [],
      "modify": ["client/components/event-model-diagram.tsx"]
    },
    "description": "Add SVG overlay for cross-slice arrows. Build node lookup map, resolve feeds references, draw dashed SVG paths with arrowhead markers between source and target nodes across slice columns. Re-compute on resize via ResizeObserver."
  },
  {
    "id": "T-4",
    "name": "Invalid block fallback",
    "ucs": ["UC-4"],
    "depends": ["T-2"],
    "wave": 2,
    "kind": "code",
    "files": {
      "create": [],
      "modify": ["client/components/markdown-text.tsx"]
    },
    "description": "In the pre override's conclave:eventmodel branch, validate parsed JSON (check slice field exists). Valid blocks return null (diagram handles them). Invalid blocks fall through to standard code block rendering with copy button."
  },
  {
    "id": "T-5",
    "name": "Expandable node fields",
    "ucs": ["UC-3"],
    "depends": ["T-3"],
    "wave": 3,
    "kind": "code",
    "files": {
      "create": [],
      "modify": ["client/components/event-model-diagram.tsx", "client/style.css"]
    },
    "description": "Add expand/collapse state for nodes with fields. Track expanded set in useState, toggle on click, render field key:type pairs in a collapsible container below the node name. Add CSS for expandable nodes and field display."
  }
]
```

## Wave 0 (parallel)

### T-0: Add EventModel types
- **UCs**: (prerequisite for all)
- **Files**: modify `client/types.ts`
- **Summary**: Add TypeScript types for the `conclave:eventmodel` JSON schema — `EventModelSlice`, `EventModelCommand`, `EventModelEvent`, `EventModelProjection`, `EventModelNodeFields`. Place after the existing `UseCase` type.
- **Tests**: Type-only — verified by `bun run check`.

### T-1: Document conclave:eventmodel block
- **UCs**: (documentation)
- **Files**: modify `doc/components.md`
- **Summary**: Add a `## conclave:eventmodel` section after the `conclave:usecase` section. Include the full schema table from the epic's analysis.md, document rendering behavior (multi-column diagram, tier alignment, within-slice arrows, cross-slice feeds, expandable fields, fallback), and provide an example block. Follow the same format as the existing `conclave:usecase` section.
- **Tests**: None (documentation only).

## Wave 1 (after wave 0)

### T-2: Core diagram component and integration
- **Depends on**: T-0
- **UCs**: UC-1
- **Files**: create `client/components/event-model-diagram.tsx`, modify `client/components/markdown-text.tsx`, modify `client/style.css`
- **Summary**: The main implementation task. Three subtasks:

  **1. Create `event-model-diagram.tsx`:**
  - Component accepts `{ slices: EventModelSlice[] }`
  - Renders a flex layout with a tier labels gutter (left) and slice columns (right, horizontally scrollable)
  - Five fixed tiers top-to-bottom: screen, command, events, projections, side effects
  - Each node gets a tier-specific CSS class for color coding (screen=neutral, command=blue, event=orange, projection=gray, side-effect=green)
  - Nodes with `new: true` get a small indicator dot
  - Empty tiers render as blank spacer cells for alignment
  - Within-slice arrows: CSS pseudo-elements draw vertical connectors between adjacent populated tiers
  - Slice header shows `label` or falls back to `slice` id

  **2. Modify `markdown-text.tsx`:**
  - Import `EventModelDiagram` and `EventModelSlice` type
  - In `MarkdownText`, before the return, extract all `conclave:eventmodel` blocks from raw `text` using regex: `` /```conclave:eventmodel\n([\s\S]*?)```/g ``
  - Parse each match with `JSON.parse`, validate `slice` field exists, collect valid slices
  - In the `<pre>` override, add `conclave:eventmodel` branch that returns `null` for valid blocks
  - After the `<ReactMarkdown>` output, render `<EventModelDiagram slices={validSlices} />` if any valid slices exist

  **3. Add CSS to `style.css`:**
  - Add `.em-diagram` section after the Use Case Cards section
  - Style grid layout, tier labels, slice columns, slice headers
  - Node styles with tier-specific colors: command `#5b9fd4` on `rgba(91, 159, 212, 0.12)`, event `var(--accent)` on `rgba(212, 148, 76, 0.1)`, projection `var(--text-muted)` on `var(--bg-elevated)`, side-effect `var(--success)` on `var(--success-dim)`, screen `var(--text-secondary)` on transparent
  - "New" indicator dot (4px filled circle, top-right of node)
  - Within-slice arrow connectors (vertical lines + arrowheads via pseudo-elements)
  - Consistent tier row heights for cross-column alignment

- **Tests**:
  - Render a single slice with all tiers populated — verify all five tier nodes appear
  - Render a single slice with only events and projections — verify empty tiers are blank, arrows connect only populated tiers
  - Render multiple slices — verify they appear as side-by-side columns with aligned tier rows
  - Render a slice with `label` — verify the label appears in the column header
  - Render a slice without `label` — verify `slice` id is used as fallback

## Wave 2 (after wave 1, T-3 and T-4 in parallel)

### T-3: Cross-slice feed arrows
- **Depends on**: T-2
- **UCs**: UC-2
- **Files**: modify `client/components/event-model-diagram.tsx`
- **Summary**: Add SVG-based cross-slice arrows for `feeds` references.
  - Add `useRef` on the diagram container and `useEffect` for post-mount measurement
  - Assign `data-node-name` attributes to rendered nodes
  - Build a lookup map: `nodeName → DOM element` for all nodes across all slices
  - For each node with `feeds`, resolve target nodes by name in the lookup
  - For resolved pairs, compute positions relative to the SVG overlay using `getBoundingClientRect`
  - Render `<svg>` overlay with `<path>` elements: dashed stroke, `var(--text-muted)` color, arrowhead `<marker>` at target end
  - Unresolved `feeds` references are silently ignored
  - Add `ResizeObserver` on the container to re-compute arrow positions on resize
  - Add CSS for `.em-diagram__arrows` SVG overlay (position absolute, pointer-events none)

- **Tests**:
  - Render two slices where slice A's event feeds slice B's projection — verify an SVG path is drawn
  - Render a `feeds` reference to a nonexistent node — verify no error, no arrow
  - Render three slices with multiple cross-slice feeds — verify all arrows render

### T-4: Invalid block fallback
- **Depends on**: T-2
- **UCs**: UC-4
- **Files**: modify `client/components/markdown-text.tsx`
- **Summary**: Refine the `conclave:eventmodel` branch in the `<pre>` override to handle invalid blocks gracefully.
  - In the `conclave:eventmodel` branch, attempt `JSON.parse` on the extracted code text
  - If parse succeeds and `result.slice` is a non-empty string, return `null` (diagram handles it)
  - If parse fails or `slice` is missing/empty, fall through to the default code block rendering (with language label and copy button)
  - This means the initial `conclave:eventmodel` check in `<pre>` should not blindly return `null` — it must validate first

- **Tests**:
  - Render invalid JSON in a `conclave:eventmodel` block — verify it renders as a standard code block
  - Render valid JSON missing the `slice` field — verify same fallback
  - Render one valid and one invalid block — verify valid renders as diagram, invalid as code block
  - Render a message with no `conclave:eventmodel` blocks — verify normal rendering unaffected

## Wave 3 (after wave 2)

### T-5: Expandable node fields
- **Depends on**: T-3
- **UCs**: UC-3
- **Files**: modify `client/components/event-model-diagram.tsx`, modify `client/style.css`
- **Summary**: Add expand/collapse interaction for nodes with `fields`.
  - Add `useState<Set<string>>` for expanded node keys (format: `${sliceIndex}-${tier}-${nodeIndex}`)
  - On nodes with `fields`, add `onClick` handler that toggles the key in the set, and `cursor: pointer`
  - Add `.em-diagram__node--expandable` class to nodes with fields
  - When expanded, render `.em-diagram__fields` container below the node name with key:type pairs
  - Each field: `<span class="em-diagram__field-key">key</span>: <span class="em-diagram__field-type">type</span>`
  - CSS: expandable cursor, fields container with smaller mono font, key in accent color, type in muted color
  - Note: expanding a node may shift layout — cross-slice arrows (T-3) should re-compute if a ResizeObserver is in place. Verify this works.

- **Tests**:
  - Render a node with fields, simulate click — verify fields appear
  - Click again — verify fields collapse
  - Render a node without fields — verify not clickable
