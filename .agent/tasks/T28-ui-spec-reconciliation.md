# T28 — UI-SPEC reconciliation into ARCHITECTURE.md

| Field | Value |
|---|---|
| **Status** | **complete** — 2026-08-16 |
| **Phase** | 2 |
| **Cluster** | judgment |
| **Blocked by** | — |
| **Blocks** | T30 (and T31, T33, T35 transitively) |
| **Spec** | UI-SPEC §9 (A1–A7); ARCHITECTURE §5.9, §10.1, §10.4, §10.5, §10.7, §13.1, §13.4, §15.3, §17.1 |
| **PRD** | D19, D25, D-08 |

## Goal

`docs/ARCHITECTURE.md` describes the interface the project is actually building. Seven
amendments — A1 through A7 of UI-SPEC §9 — are landed in place, each argued at its own
site rather than by reference to another document, and every task doc written against a
superseded clause is updated in the same commit. After this task the architecture and the
interface specification do not disagree anywhere an implementer must act, and
`docs/SPEC-FINDINGS.md` records the seven with a verdict and a date.

## Why this shape

T26 established the pattern and the reason for it: a spec that contradicts itself is
discovered mid-implementation, at the most expensive moment, and the cheapest fix is a
prose edit landed before the code. These seven are the same class — A1 replaces a clause
(§10.7's "no pan, no zoom, no camera") that a T30 implementer would otherwise read as
normative and obey. UI-SPEC is explicitly non-normative outside presentation (§1), so an
amendment that is *only* in UI-SPEC is not an amendment at all; the architecture remains
the document CI, tests and every earlier task doc are written against. They land together
because A2 and A6 touch sections A1 also touches, and three commits over §10.7 would
produce three intermediate states none of which is coherent.

## Scope

**In scope** — the seven amendments, each needing a spec edit and a findings entry:

- **A1 — §10.7.** "No pan, no zoom, no camera" is replaced by the two-level stepped
  camera (UI-SPEC §5.1). The list substitution moves from a viewport threshold to a zoom
  level (UI-SPEC §8.1). Both routes stay prerendered.
- **A2 — §10.1, §10.4, D-08.** The region union survives untouched and still produces
  eight silhouettes; a skill-hex sub-lattice layer is added, drawn only for the focused
  region. **D-08's reasoning is strengthened, not weakened** — it is exactly what keeps
  level 0 at eight paths, and the amendment must say so or a later reader will take the
  sub-lattice as licence to reopen it.
- **A3 — §10.5.** Fill is a water line at full plate strength, not an opacity ramp. §10.5
  already required a partly-filled region to keep its full-strength outline and label; the
  amendment makes the rest of the section agree with that sentence.
- **A4 — §17.1.** A font row of ~12 kB; first-paint total ≤ 70 kB becomes ≤ 82 kB.
- **A5 — §15.3.** The convergence claim is **restated, not dropped**: small-viewport and
  screen-reader experiences converge at the *skill* level; at world level the screen
  reader gets the region list and the phone gets the map, and both carry the same channels
  in the same documented order.
- **A6 — §13.1, §13.4.** `/d/<domainId>` becomes a camera state over the map surface
  rather than a separate page; both routes stay prerendered. `+layout` gains the sidebar,
  Find, Info and the next-step card.
- **A7 — §5.9.** `domains.yaml`'s `palette` gains light and dark variants. Additive.

Plus the one compiler correctness note that belongs with A2 (UI-SPEC §9's closing): region
corners are held as **exact integers on the hex lattice** — `(2q + r ± 1, 3r ± 1|2)` for
pointy-top — and converted to pixels only at emit. This is what §10.4's "snapping to a
shared vertex grid" means, and it is the clause that stops it being implemented as
`toFixed(2)`.

Plus **D19 is recorded as resolved** in the PRD decision log (UI-SPEC §4.1, §4.2), and
**D25 as partially addressed**, with its remainder named (UI-SPEC §12 Q4).

**Out of scope**

- Any code. A4's budget change and A7's schema change are **T27**'s; this task edits the
  documents that describe them.
- Anything UI-SPEC leaves open — §12's five questions are open questions, not findings.
  Q1 belongs to T27, Q2 to T29; Q3–Q5 have no owner yet and must not be invented one here.
- Re-litigating the eleven U-decisions. They are agreed (UI-SPEC §1 status line). An
  amendment that contradicts a U-decision is a change request to UI-SPEC, not a T28 edit.

## Deliverables

```
docs/ARCHITECTURE.md    A1–A7 landed in place, at their own sites
docs/SPEC-FINDINGS.md   seven entries: amendment, verdict, reason, date
docs/PRD.md             D19 resolved; D25 partially addressed, remainder named
.agent/tasks/*.md       every doc written against a superseded clause, updated
```

## Interface contract

No code interface. The normative outputs other tasks are written against are the amended
sections themselves:

```
§10.7   the two-level camera and the zoom-level list threshold   → T30, T31
§10.1   the sub-lattice layer, D-08 restated                     → T29, T31
§10.5   the water line                                           → T30, T31, T34
§15.3   the restated convergence claim                           → T31, T35
§13.4   +layout gains sidebar, Find, Info, next-step card        → T32, T33
§17.1   82 kB                                                    → T27
§5.9    the palette shape                                        → T27
```

## Acceptance criteria

- [x] `grep -n "no pan, no zoom" docs/ARCHITECTURE.md` returns nothing.
- [x] §10.7 describes the two levels, their routes, and the phone list substitution at
      level 1 rather than at a viewport threshold.
- [x] §10.4 states the exact-integer corner rule and names the failure it prevents.
- [x] D-08 in the decision log still reads as a live decision, with the sub-lattice named
      as a layer over it rather than as an exception to it.
- [x] §15.3's convergence sentence is present and asserts the same-content-same-order
      property, not the same-view property.
- [x] §17.1's total reads 82 kB and its rows sum to it.
- [x] `docs/SPEC-FINDINGS.md` carries A1–A7 with a verdict, a reason and a date, in the
      form T26's twenty-seven findings established.
- [x] Every task doc naming a superseded clause is updated. Verified by
      `grep -rn "no camera\|viewport threshold\|70 kB" .agent/tasks/` returning only
      historical notes explicitly marked as such.
- [x] PRD D19 reads resolved and points at UI-SPEC §4; D25 names its remainder.

## Verification

```bash
grep -n "no pan, no zoom\|70 kB" docs/ARCHITECTURE.md    # must be empty
grep -n "82 kB" docs/ARCHITECTURE.md                     # must hit §17.1
grep -rn "70 kB" .agent/tasks/                           # only marked-historical hits
```

## Notes and hazards

- **A2 is the one that can be got backwards.** The sub-lattice is drawn only for the
  focused region and exists precisely because D-08 keeps level 0 at eight paths. An
  amendment that reads as "the map now has a hex grid" reopens the decision D-08 closed
  and hands a later implementer permission to render 500 hexes at level 0.
- **A5 is a restatement, and the temptation is deletion.** The claim it makes is still
  true, at a different level. Deleting it removes the only place the spec asserts that the
  two accessible surfaces carry the same content in the same order, which N5 depends on.
- **The compiler corner note is not cosmetic.** In a prototype over these eight regions,
  two of the eight failed to close when interior-edge cancellation was keyed on rounded
  floats. T12 shipped; whether its implementation already holds exact integers must be
  **checked, not assumed**, and if it does not, that is a T12 defect to file rather than
  something to fix quietly here.
- **Follow T26's discipline: append findings, resolve in place, do not open a successor
  reconciliation task.** If an eighth amendment surfaces while landing these seven, it
  belongs in this document.
