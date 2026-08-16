# T32 — Shell chrome: sidebar and the next-step card

| Field | Value |
|---|---|
| **Status** | pending |
| **Phase** | 2 |
| **Cluster** | views |
| **Blocked by** | T27 |
| **Blocks** | T33, T35 |
| **Spec** | UI-SPEC §6.1, §6.4, §9 (A6); ARCHITECTURE §13.4, §15.2, §15.4 |
| **PRD** | F36, N5, D25 |

## Goal

The application has a shell. A collapsible left sidebar replaces the current top nav and
carries four blocks — primary nav, the eight domains, the user's started skills, and
domain progress as text — with its collapsed state persisted locally. Bottom-left, a
persistent next-step card names one concrete milestone and flies the camera to it. After
this task a returning user can reach the skill they opened the app for without touching
the map, and a first-time visitor is told what to do next before they take an action.

## Why this shape

The two audiences have opposite session shapes and the chrome is where that is resolved.
The Player opens the app a few times a week, briefly, because they finished something;
their whole session is land, see where I am, go to the thing, tick it, leave — which is
why **block 3 is the most-used control in the application** and why it links straight to
`/s/<treeId>` rather than through the map. The sidebar also gives the map its vertical
extent back, which a top bar was spending. The next-step card is the one place this design
deliberately goes beyond its reference: F36 and §15.2's `.` shortcut already promise the
concrete next action, the PRD calls it the product's central differentiator, and nothing
above the tree level surfaced it. The prior-art review found both poles of this axis and
both fail — one product bought perfect orientation by deleting all agency, the other has
total agency with weak orientation and left its "recommended next" affordance behind an
experiment flag.

## Scope

**In scope**

- **The sidebar**, left, collapsible to an icon rail, collapsed state persisted locally,
  replacing the current top nav bar. Four blocks in this order:
  1. **Primary nav** — Map, Library, Data, About, Contribute.
  2. **Domains** — all eight, nested, active one highlighted. Doubles as the "where am I"
     indicator at level 1.
  3. **Your skills** — started trees with attained level, linking to `/s/<treeId>`.
     Empty for a first-time visitor and rendered as an **invitation, not a void**.
  4. **Domain progress** — the eight band names (Quiet → Deep) and skills-started counts,
     as text. Deliberately redundant with the map: N5 requires these numbers to exist as
     text somewhere, and this is a better home than a focus-only announcement.
- **The next-step card**, bottom-left, always visible on the map: one milestone, named
  concretely (*"Blacksmithing · Forge a J hook"*), which flies the camera and opens the
  milestone when activated. **Selection rule:** the next available milestone (F36) in the
  skill with the most recent activity, ties broken by tree id for stability. Dismissible
  for the session; an invitation when the user has started nothing.
- **A6's layout change** — `+layout` owns the sidebar and the card. (Find and Info are
  T33's, but the slots they occupy are established here.)
- **The card is a landmark** (§8.2), reachable without traversing the map.
- Both surfaces styled from T27's tokens; display face on headings only.

**Out of scope**

- **Find and Info — T33.** They sit bottom-right; this task must leave that corner free
  and must not implement a search box in the sidebar.
- The map itself, its camera and its levels — **T30**.
- Band *values* and boundaries: F18 already fixed five bands (Quiet, Emerging, Moderate,
  Active, Deep) as tunable data in §11.6. This task renders them and must not redefine
  them.
- **UI-SPEC §12 Q3** — whether the card should prefer most-recent-activity or
  nearest-to-completion. Recency is specified and ships; the alternative is revisited once
  three trees exist. Do not implement both behind a flag.

## Deliverables

```
app/src/routes/+layout.svelte              sidebar + card slots (A6)
app/src/lib/components/Sidebar.svelte      the four blocks, collapse, persistence
app/src/lib/components/Sidebar.test.ts     block order, empty state, persistence
app/src/lib/components/NextStepCard.svelte the card, its landmark role, dismissal
app/src/lib/components/next-step.ts        the selection rule — pure
app/src/lib/components/next-step.test.ts   recency, tie-break, empty, dismissed
```

## Interface contract

```ts
// next-step.ts — pure. The shell assembles the rows; the component takes the result.
export interface NextStep {
  readonly treeId: string;
  readonly skillTitle: string;
  readonly milestoneUid: string;
  readonly milestoneTitle: string;
  readonly domain: DomainId;
}

/** The next available milestone (F36) in the skill with the most recent activity.
 *  Ties broken by tree id, ascending, for stability across renders. Null when the user
 *  has started nothing — the caller renders the invitation. */
export function selectNextStep(candidates: readonly NextStepCandidate[]): NextStep | null;

// Sidebar block 3 and block 4 rows
export interface StartedSkillRow { treeId: string; title: string; attainedLevel: number; }
export interface DomainProgressRow { domain: DomainId; band: string; started: number; }
```

## Acceptance criteria

- [ ] The top nav bar is gone; `grep -rn "nav" app/src/routes/+layout.svelte` shows the
      sidebar as the only primary navigation.
- [ ] The four blocks render in the specified order, and block 2 highlights the active
      domain at level 1.
- [ ] Block 3 links directly to `/s/<treeId>` — reaching a started skill from a cold load
      takes one click and never touches the map.
- [ ] With no started skills, block 3 renders an invitation with a real action, not an
      empty list.
- [ ] Block 4 renders each domain's band **name** and started count as text; no number in
      it is a raw fill percentage (F34).
- [ ] Collapsing the sidebar persists across a reload and does not shift the map's camera.
- [ ] `selectNextStep` picks the most-recently-active skill's next available milestone, and
      breaks ties by tree id — asserted over a fixture with two equal timestamps.
- [ ] The card is exposed as a landmark and is reachable by keyboard before the map.
- [ ] Dismissing the card hides it for the session and it returns on the next load.
- [ ] `app/a11y/manual-passes.mjs` passes unchanged.

## Verification

```bash
npm test --workspace app -- Sidebar NextStepCard next-step shell
npm run build && npm run a11y:manual --workspace app
npm run check:budget
```

## Notes and hazards

- **The card must be genuinely dismissible and genuinely persistent-per-session.** A card
  that returns mid-session is an interruption; one that never returns is a feature the user
  loses by accident.
- **Block 3 is why the Player opens the app.** If it is below the fold on a laptop, the
  sidebar's block order has failed regardless of what the spec table says.
- **Block 4 is redundant on purpose.** An implementer will try to delete it as duplicated
  map information; N5 depends on it, because F34 forbids the number appearing on the map.
- **The card's selection needs data the map already assembles.** Route it through the
  shell's derived layer — components import neither `lib/state` nor `lib/content` (§14.1),
  and a second producer of this row is exactly the drift F4 closed at the engine boundary.
- **`.`'s existing behaviour in the tree is unchanged.** The card is its map-level
  counterpart, not a replacement, and T34 owns the tree-side visual counterpart.
