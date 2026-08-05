# T08 — TreeView renderer

| Field | Value |
|---|---|
| **Status** | pending |
| **Phase** | 0 |
| **Cluster** | views |
| **Blocked by** | T06, T07, T11a |
| **Blocks** | T10, T19, T20 |
| **Spec** | ARCHITECTURE §9 |
| **PRD** | F10, F31, S1 |

## Goal

`app/src/lib/components/TreeView.svelte` exists as the single component that renders a
positioned tree (§8's output) as an interactive SVG for linear, branching, and
choice-based skills alike. After this task, opening a skill route shows every level as a
band of nodes with the correct glyph, fill, and border for its state; clicking or
keying into a node opens the milestone detail panel with its actions; and the component
compiles into a build with zero references to `archetype` anywhere under
`lib/layout/`, `lib/scoring/`, or `lib/components/`.

## Why this shape

D-07 resolved D3 in favour of one component with no per-archetype shells: by the time
data reaches the renderer, a linear skill, a branching skill, and a choice-based skill
are the same shape of data with different values — column count and the presence of
`module` labels are the only variance. §9.1 makes this **S1's mechanical form**:
`archetype` is readable from the manifest for a UI label, but a grep proving it appears
nowhere in the renderer is a one-line CI check (§14.7), and that check is only true if
this component never branches on it. This is the point of the task, not an incidental
property — an implementer who adds `if (archetype === 'choice-based')` anywhere in this
component has silently reopened D3 and broken S1.

## Scope

**In scope**

- The `<TreeView>` component: SVG structure per §9.2, five node states per §9.3, click
  and keyboard interaction per §9.4, narrow single-column presentation per §9.5, level
  chrome and the mastery panel per §9.6.
- Toggling a milestone's state as a CSS class change on an already-positioned node —
  never a re-run of layout, never DOM re-creation (§9.3).
- Focus-driven edge highlighting: focusing a node highlights its incoming/outgoing edges
  and dims the rest (§9.4), mitigating §8.4's accepted edge crossings.
- The §11.10 consequence-warning intercepts before a destructive dismissal or un-check —
  the UI-side half of D-22 and D-18 (§9.4, §11.10).
- The CI grep gate proving `archetype` appears in none of `lib/layout/`, `lib/scoring/`,
  `lib/components/` (§14.7, S1's mechanical form).
- Consuming `SkillProgress` (node states, level progress, `attainedLevel`, `cleared`,
  `blocker`) as props — this component never imports the Scoring Engine directly (§13.4).

**Out of scope**

- Positioning and the grid layout algorithm — T07, the Layout Engine (§8). TreeView
  consumes `layoutTree`'s output; it does not compute it.
- The Scoring Engine's state derivation (`scoreSkill`, node state rules) — T11. TreeView
  renders `NodeState` values, it does not derive them.
- The milestone detail panel's own component (`MilestonePanel`) beyond the actions
  TreeView's node interaction opens it with — §13.4 names `MilestonePanel` as a sibling
  component; wiring its full content is a separate deliverable if not already covered by
  T10.
- Persisting the dismissal or completion the user triggers — the User State Store
  (§14.5), T09.
- The dismissed-state end-to-end behaviour beyond the intercept warning text itself —
  T19 owns denominator semantics and the full dismiss/undismiss flow.
- Screen-reader-specific accessible names, descriptions, and keyboard model beyond what
  §9.2/§9.4 already specify structurally — the full §15 pass is T20.
- The map renderer and its channels — §10, T13.

## Deliverables

```
app/src/lib/components/TreeView.svelte       the single renderer, §9 in full
app/src/lib/components/TreeView.test.ts       node-state, interaction, and S1 tests
tools/ci/check-archetype-free.sh              or equivalent grep gate wired into CI (§14.7)
```

## Interface contract

```html
<!-- ARCHITECTURE §9.2 — SVG structure, verbatim -->
<svg viewBox="0 0 {W} {H}" role="group" aria-labelledby="tree-title">
  <g class="edges" aria-hidden="true">      <!-- decorative; §15 carries the semantics -->
    <path class="edge" d="…" data-from="k7m2qp9x" data-to="m3xk90ab"/>
  </g>
  <g class="rows">                          <!-- level bands + tier labels -->
    <g class="row" data-level="1">…</g>
  </g>
  <g class="nodes">
    <g class="node is-complete" data-uid="k7m2qp9x"
       tabindex="0" role="button" aria-describedby="ms-k7m2qp9x-desc">
      <rect …/><text …/><use class="state-glyph" href="#glyph-complete"/>
    </g>
  </g>
</svg>
```

```
// ARCHITECTURE §9.3 — node state table, verbatim

| State | Meaning | Glyph | Fill | Border |
|---|---|---|---|---|
| complete | Done (F31) | ✓ | domain accent | solid |
| bonus | Complete, but beyond its group's threshold (F11) | ✓ | domain accent, lighter | solid |
| available | Prerequisites satisfied, not done (F36) | ○ | surface | solid, emphasized |
| locked | Prerequisites unmet | ‧ | surface, recessed | dashed |
| dismissed | "Not for me" (F46) | ✕ | surface, recessed | dotted |
```

```ts
// ARCHITECTURE §14.4 — the props this component consumes, produced by the Scoring Engine
export type NodeState = 'complete' | 'bonus' | 'available' | 'locked' | 'dismissed';

export interface SkillProgress {
  levels: LevelProgress[];       // always 10 entries
  attainedLevel: number;         // §11.3 — highest contiguous satisfied prefix
  cleared: number[];             // §11.3 — satisfied levels; never summed
  blocker?: { level: number; shortfall: GroupProgress[] };   // §11.3
  tier: TierName;
  nodeStates: ReadonlyMap<string, NodeState>;
  available: string[];           // uids, prerequisites met, incomplete — F36
}
```

Component props are `(tree: CompiledTree, positions: LayoutResult, progress: SkillProgress,
viewport: 'wide' | 'narrow')` — `positions` from T07's `layoutTree`, `progress` from T11's
`scoreSkill`. TreeView performs no computation over either; it renders them and emits
user intent (complete, dismiss, undo, note) upward for the User State Store (T09) to
apply.

## Acceptance criteria

- [ ] `grep -rn archetype app/src/lib/layout app/src/lib/scoring app/src/lib/components`
      returns no matches — the §14.7 / S1 mechanical check, run as a CI step.
- [ ] Every one of the five §9.3 states renders a distinct glyph (a real `<use>` element,
      not a CSS background) and a distinct border style, verified by a component test that
      asserts on the rendered glyph `href` and border class per state — not colour alone
      (N5).
- [ ] Toggling a milestone's state in a test changes only the node's CSS class; a spy on
      the layout function proves it is not re-invoked (§9.3, §8.6).
- [ ] `<g class="edges">` carries `aria-hidden="true"` in the rendered output (§9.2).
- [ ] Clicking or pressing Enter/Space on a node opens the milestone detail panel with
      `detail` prose, prerequisites listed by title, and the complete/note/dismiss/undo
      actions (§9.4).
- [ ] Focusing a node adds a highlight class to its incoming and outgoing edges and a dim
      class to the rest, verified against a fixture with at least one crossing edge (§9.4,
      §8.4).
- [ ] Completing a milestone is a single action with no confirmation dialog; a component
      test asserts no modal/dialog element appears on the complete path (§9.4, F31).
- [ ] Dismissing a milestone inside an `all` group at or below the blocker shows the §11.10
      intercept text before the action commits, offering "hide it instead"; a test
      exercises the boundary case exactly (§9.4, §11.10, D-22).
- [ ] Un-checking a milestone that would drop `attainedLevel` shows the consequence before
      the action commits, stating the specific before/after level (§11.10).
- [ ] Narrow viewport renders one column, level bands as headings, no drawn edges, and
      textual "Requires: …" lines per node (§9.5).
- [ ] Each level band shows its number, tier name (F7), and one progress readout per
      requirement group — not averaged into a single bar (§9.6, §11.2).
- [ ] Mastery achievements render in a separate panel below the tree, not as an eleventh
      row, verified by asserting they are outside the `<g class="rows">` tree structure
      (§9.6, §5.7).
- [ ] `npm run --workspace app test -- TreeView` passes.

## Verification

```bash
npm run --workspace app test -- TreeView
grep -rn archetype app/src/lib/layout app/src/lib/scoring app/src/lib/components
npx tsc --noEmit --project app
```

Passing looks like: the component test suite green, the grep producing no output, and a
clean typecheck.

## Notes and hazards

- **T26 F16 (2026-08-05) gives this task its node-state producer.** §9.3's four
  scoring-derived states come from §11.1–§11.4, which now ship in Phase 0 as **T11a** — a
  new blocker on this task. §16.4's "no scoring" was reworded to "no *domain* scoring". The
  gate can therefore require `complete`, `available` and `locked` honestly, and this
  renderer needs no mode flag and no reduced-state Phase 0 variant.

- **S1 is only as strong as the grep gate.** A component that reads `archetype` for a
  label but stores it in a variable named `mode` and later branches on `mode` defeats the
  letter of the check while violating its spirit. Review for behavioural branching on
  archetype-derived values, not just the literal string.
- **Toggling state must not re-run layout (§8.6).** This is a performance requirement
  with a correctness consequence: if state toggling ever re-invokes `layoutTree`, node
  positions could theoretically shift under a live interaction, which nothing in this
  component's design otherwise permits.
- **§11.10's intercept is UI behaviour, not engine behaviour.** The Scoring Engine (T11)
  computes the consequence honestly and reports it; this component is responsible only for
  surfacing it before commit. Do not attempt to prevent the dismissal or un-check at the
  engine level — dismissal must stay reversible (D-22) and un-checking must stay a real,
  honest recomputation (§11.10).
- Full accessible-name/description wiring (`aria-describedby` targets, the exact
  live-region announcement text) is specified in §15.2 and lands in T20 — this task
  produces the structural hooks (`aria-describedby="ms-…-desc"`) but not the full content
  behind them.
