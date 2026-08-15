# Release checklist

The §16.2 checklist, and the record of the manual accessibility passes §15.8
requires. This file is the **§16.2 checklist location** referred to by
`ARCHITECTURE.md` and by the task docs; it is deliberately *not* part of
`CONTRIBUTING.md`, which T24 authors wholesale and would overwrite.

Merging to `main` deploys (§16.1). There is no staging environment and no
separate publish step, so everything below is a pre-merge gate.

---

## 0. Once, when the repository is created

**None of this is expressible in `ci.yml`.** These are GitHub repository
settings, and until they are applied the workflows run but enforce nothing: a
red check on a PR that anyone can merge anyway.

- [ ] **Settings → Pages → Source: GitHub Actions.** `deploy.yml` publishes
      through `actions/deploy-pages`; with Pages set to "Deploy from a branch"
      the workflow succeeds and the site never changes.
- [ ] **Branch protection on `main`, requiring exactly the seven gating jobs**
      — `content: validate`, `content: baseline`, `content: status`,
      `content: compile`, `app: typecheck`, `app: test`, `app: build`. Run
      `tools/ci/apply-branch-protection.sh` (needs `gh auth login` as the owner)
      or set them by hand.
- [ ] **"Require branches to be up to date before merging" ON.** Not a
      preference. §6.4 checks 5 and 6 are unsound against a stale branch
      (T26/F6): two PRs in flight can each bump one tree 4 → 5 and each pass,
      leaving `main` with a version 5 that is not the 5 that shipped, after
      which §12.5's `>` guard skips that migration for everyone who saw the
      first. A merge queue is the other acceptable answer.
- [ ] **`content: lint` is NOT in the required list.** It is advisory by
      construction (D-15); requiring it would gate merges on findings that are
      explicitly not merge-blocking.
- [ ] Confirm `content: compile` appears in the required list **in its own
      right**. A skipped required check counts as *passing*, and `app: build`
      skips on every content-only PR — which is why the compile gate was moved
      off it (T26/F24).

F42's two review rounds are recorded in each tree's `provenance` block and
checked by `lst validate` and `lst status`. Requiring approving reviews in
GitHub as well is optional and is what `--reviews 2` does; a solo maintainer
should leave it off, since the provenance record is the artifact §16.2 asks for.

## 1. Automated, per release

These fail CI; nothing here is a judgement call.

- [ ] All §6.5 gating jobs green
- [ ] `contentVersion` bumped on every tree whose compiled output changed —
      enforced by §6.4's baseline job, not by memory
- [ ] Two review rounds recorded in `provenance`, for content PRs (F42)
- [ ] `lst status` clean — the review table matches reality
- [ ] Bundle budget within §17.1 — CI fails on regression
- [ ] `npm test` green, which includes the `vitest-axe` gate on `TreeView`,
      `MapRenderer`, the milestone panel, and the composed `/` and `/s/[tree]`
      routes (§15.8)

**Axe gates but does not certify.** §15.8 puts the figure plainly: automated
checks catch roughly a third of real issues. A green axe run is not an
accessibility pass, which is why section 2 exists and is not optional.

## 2. Manual, per release touching the app

- [ ] Keyboard-only traversal of **browse → place → complete → export** (§15.8)
- [ ] Screen-reader spot check on **one desktop reader** and **one mobile
      reader** (§15.8)
- [ ] The app viewed once under `forced-colors: active` (Windows High Contrast,
      or Firefox's `browser.display.document_color_use`), confirming every
      milestone state is still distinguishable by glyph and border (§15.4)
- [ ] The app viewed once with **reduced motion** on, confirming nothing is lost
      when the fill animation and edge transitions stop (§15.5)

## 3. Manual, per schema bump

- [ ] Import an export produced by the previous version and confirm it migrates

---

## Accessibility verification record

§15.8 asks for a dated record naming the reader-and-browser combination used.
Newest first. An entry is only complete when every flow in it has a verdict.

### 2026-08-14 — T20, the accessibility pass

**Status: automated verification complete, the manual passes are outstanding and
partly not yet possible.**

Verified automatically, and asserted as tests rather than as claims:

| §15 | What is asserted | Where |
|---|---|---|
| 15.2 | Node accessible names and descriptions, including prerequisites *and whether they are met*, and the requirement group served | `TreeView.a11y.test.ts` |
| 15.2 | Every row of the keyboard table, in both viewports, over a multi-level multi-track tree | `TreeView.a11y.test.ts` |
| 15.2 | F36's `.` shortcut, over a tree whose `available` nodes are non-adjacent in the DOM | `TreeView.a11y.test.ts` |
| 15.2 | One `polite` live region stating the consequence; no `assertive` region anywhere in `src/` | `TreeView.a11y.test.ts` |
| 15.3 | Every region's name carries name, breadth, fill as a named **band**, and fogged state — in both the map and the list | `MapRenderer.a11y.test.ts` |
| 15.3 | Reading order is the manifest's domain order, walked by focus, with the geometry disagreeing | `MapRenderer.a11y.test.ts` |
| 15.4 | All five rows of the never-colour-alone table | both a11y test files |
| 15.5 | Every transition the components declare is disabled under `reduce`; no `@keyframes` and no `animation:` anywhere | both a11y test files |
| 15.7 | 44×44 hit rectangles, the three named thresholds, and the panel's `@container` rule | `TreeView.a11y.test.ts` |
| 15.8 | Zero axe violations (WCAG 2.1 A/AA) on the tree, the map, the list, the open panel, the consequence intercept, and the composed `/` and `/s/[tree]` routes | `*.a11y.test.ts`, `map-page.test.ts`, `page-render.test.ts` |

Outstanding, and why:

| Flow | Keyboard-only | Screen reader | Note |
|---|---|---|---|
| Browse | not yet run | not yet run | The views exist (T08, T13, T14); this is a real pending check, not a blocked one. |
| Place | **not possible yet** | **not possible yet** | F29's placement flow and F30's estimator are **T15**, which is not implemented. §15.6 cannot be verified against a flow that does not exist. |
| Complete | not yet run | not yet run | The views exist. |
| Export | **not possible yet** | **not possible yet** | Export and import are **T16**, not implemented. |

So the manual half of §15.8 needs one pass now for browse and complete, and a
second pass once T15 and T16 land. **T20 stays open on that basis** — §15.8's
manual items are load-bearing acceptance criteria, not follow-up.

### R-07 — accepted, with its mitigation

§15.8 records the honest residual risk: a solo maintainer will not test every
reader-and-browser combination. It is **accepted, not scheduled**. The
structural mitigation is D-10 itself — the linear list is the *primary*
representation for assistive technology at every viewport, and it is the same
list §8.5's narrow layout produces for every mobile user, so it is exercised
constantly rather than only when someone remembers to check it. Broader manual
coverage is not the mitigation and is not a target.

### Reintroduction hazard

Most §15.4 violations look correct to a sighted reviewer, which is why the table
is enumerated in the spec at all. **Any PR touching node or region styling needs
a re-check against §15.4's five rows**, not merely a green test run — a new
signal carried by hue alone would pass every assertion in this repository, since
the assertions can only check the channels that exist.
