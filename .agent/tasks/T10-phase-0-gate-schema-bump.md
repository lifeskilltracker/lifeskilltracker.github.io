# T10 — PHASE 0 GATE: schema review and breaking bump

| Field | Value |
|---|---|
| **Status** | pending |
| **Phase** | 0 |
| **Cluster** | judgment |
| **Blocked by** | T05, T08, T09 |
| **Blocks** | T11b, T12, T21 |
| **Spec** | ARCHITECTURE §5.10, §16.4, §19.2 |
| **PRD** | N8; ARCHITECTURE R-14 |

## Goal

Phase 0 is proven and the schema is either confirmed or bumped. One exemplar tree has
travelled the whole pipeline — authored in YAML, validated, compiled to JSON, laid out
arithmetically, rendered as SVG, and completed with the completion surviving a page
reload. Every flaw that journey exposed in schema v1 has been either fixed under a
version bump with a working migration, or recorded as deliberately tolerated. Phase 1
does not begin until this document's criteria are all true.

## Why this shape

§16.4 is explicit that **phase 0 exists to falsify the schema before content authoring
starts**. C4 names authoring as the real bottleneck, so the expensive mistake is
discovering a schema flaw after three trees are written; **R-14** goes further and says to
*expect* at least one breaking bump here and to take it now, while the corpus is small
enough that migration is trivial. That makes this a stop rather than a checkpoint. It is
also why T21 — the branching and modular exemplars — is gated on this task rather than
running alongside the earlier content work: authoring two more trees against a schema
about to change is the exact waste phase 0 was designed to prevent.

## Scope

**In scope**

- Verifying the Phase 0 exit criteria end to end, by hand, not by CI.
- A written schema review: what schema v1 got wrong, right, or left ambiguous, judged
  against real use by T05's tree, T06's layout, T08's renderer and T09's store.
- Deciding per finding whether it warrants a bump, using §5.10's table.
- If bumping: `schemaVersion` increments, `schema/*.json` change, `content/` is migrated
  in place by a script, and the export migration ships in the same PR.
- If not bumping: the review is still written and committed, recording what was
  considered and why v1 stands. A silent pass makes the next reviewer redo the work.
- Regenerating types (T02's `gen:types`) and reconciling every consumer.

**Out of scope**

- New features of any kind. This task changes the schema only where phase 0 proved it
  wrong; a field that would be *nice* is not a finding.
- The Scoring Engine, map, export, and everything else in Phase 1 — T11b onward. Their
  requirements are known from §11 and §12 and may inform the review, but building against
  a schema is not the same as reviewing it, and speculative accommodation is how a schema
  acquires fields nothing uses.
- Authoring trees 2 and 3 — T21, which this task unblocks.
- Promoting anything to a CI gate — T25.

## Deliverables

```
docs/SCHEMA-REVIEW-P0.md         the written review and its verdict
schema/*.json                    amended only if the review calls for it
app/src/lib/types/authored.d.ts  regenerated
tools/src/migrate/v1-to-v2.ts    only if bumping — rewrites content/ in place
tools/src/migrate/export-v1-to-v2.ts   only if bumping — §12.6 import chain
content/trees/*.yaml             migrated in place to current
```

## Interface contract

None new. This task may *change* contracts established in T02, and if it does, every
change must propagate in the same commit — §4.2's whole argument for a shared `schema/`
is that the validator and the renderer break together, loudly, rather than drifting.

§5.10's bump policy is the decision rule and is normative:

| Change | Bump? | Cost |
|---|---|---|
| New optional field | no | none |
| New enum value (a facet, a domain) | no | taxonomy edit only |
| New required field | **yes** | content migration script |
| Field removed or retyped | **yes** | content migration + export migration |
| Field semantics changed | **yes** | as above, and it should be a new field instead |

## Acceptance criteria

**Phase 0 exit — each verified by hand:**

- [ ] `npx lst validate content/trees/<exemplar>.yaml` passes on a tree with no `uid`
      lines, then `npx lst ids` fills them, then validation still passes.
- [ ] `npx lst compile` emits `manifest.json` and a content-hashed bundle.
- [ ] The app serves `/s/<treeId>` and renders the tree as SVG.
- [ ] Node positions are identical across two consecutive loads, and identical after a
      milestone is completed — the F13/N11 stability guarantee holds in practice.
- [ ] Completing a milestone updates the rendering, and the completion survives a full
      page reload.
- [ ] Un-completing it removes the completion, and that also survives reload.
- [ ] No console error at any point in the above.

**Schema verdict:**

- [ ] `docs/SCHEMA-REVIEW-P0.md` exists and records every finding with a verdict of
      *bump*, *fix without bump*, or *tolerate*, each with a reason.
- [ ] Every finding marked *tolerate* names the risk it accepts.
- [ ] If bumped: `schemaVersion` is incremented in `schema/`, in every file under
      `content/`, and in `export.schema.json` where §12.6 requires it.
- [ ] If bumped: the migration script runs over the whole corpus in CI and is idempotent
      — running it twice produces no second diff.
- [ ] If bumped: an export file produced before the bump imports successfully after it.
      This is §16.2's manual per-schema-bump check and it is not optional.
- [ ] `npm run gen:types` produces no diff after the change is committed.
- [ ] `npm test && npm run typecheck` pass across both workspaces.

## Verification

```bash
npm test && npm run typecheck
npx lst validate content/trees/*.yaml
npx lst compile && npm run build --workspace app
npm run migrate && git diff --exit-code    # idempotence, if a migration exists
```

Then the manual pass: open the tree, complete a milestone, reload, un-complete, reload.

## Notes and hazards

- **R-14 is the reason this task exists.** Schema v1 was designed before a single tree
  was written. Expect a bump; a review that finds nothing is more likely to be an
  incurious review than a perfect schema. Push specifically on the fields §5 marked as
  uncertain and on anything T05's author found awkward to write by hand.
- **N8's "documented migration path" is satisfied by the script existing and running in
  CI over the whole corpus**, not by a prose promise. If the review bumps, the script is
  the deliverable that discharges N8.
- **The app reads current and one prior version** (§5.10). Older exports migrate through
  the chain on import. Bumping twice before v1 ships would put an export outside that
  window, so if a second bump becomes tempting during Phase 1, prefer folding it into
  this one.
- **Do not let Phase 1 requirements drive schema changes here.** §11 and §12 are known and
  may legitimately expose a v1 flaw, but "the Scoring Engine would be tidier if" is a
  design preference, not a falsification. The bar is: phase 0 proved this wrong.
- **§5.4's uid rules are not up for review.** Slugs are mutable, uids never are, and a
  retired slug may never be reused. Those are D-05 and the whole identifier scheme rests
  on them.
- This gate has no CI representation. It is a human judgment recorded in a document, and
  the only enforcement is that T11b, T12 and T21 are blocked on it.
