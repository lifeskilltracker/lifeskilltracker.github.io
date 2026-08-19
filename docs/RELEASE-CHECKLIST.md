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
      — `npm run build && npm run a11y:manual --workspace app` drives all four
      against the production build in Chromium and exits non-zero on failure.
      Read the summary; a green run is the evidence for this line.
- [ ] Screen-reader spot check on **one desktop reader** and **one mobile
      reader** (§15.8). **Not covered by the script**, which reads the
      accessibility tree but cannot tell you how a reader behaves over it.
      Record the reader-and-browser pair used, below.
- [ ] **The composed reduced-motion audit** (§15.5) —
      `npm run a11y:reduced-motion --workspace app`. Twelve checks over the six
      animations the interface has: the first-load reveal, the map camera fly,
      the skill-hex layer, the Find dim, the water line and focus dim, and the
      tree level camera. It asserts both halves of §15.5 — that the motion is
      *gone* rather than shortened, and that what the motion carried is still on
      the page as text or as an attribute. **An animation added to any of those
      surfaces belongs on that list**; a new one that nobody adds is caught only
      by the script's whole-page sweep, which is the weaker of the two checks.
- [ ] **The composed forced-colors check** (§15.4) —
      `npm run a11y:forced-colors --workspace app`. Ten checks: §4.6's glyph
      library, the states it can reach live (it drives placement and a dismissal
      to render four of the five), that no two rendered states share a glyph and
      a border, that nothing sets `forced-color-adjust: none`, and that fog, the
      water line and the hex borders all survive the palette being replaced.
- [ ] The app viewed once **by eye** under `forced-colors: active` (Windows High
      Contrast, or Firefox's `browser.display.document_color_use`) and once with
      **reduced motion** on. The two scripts above cover the Chromium half of
      each; neither can tell you the result still *reads* as a map.

## 3. Manual, per schema bump

- [ ] Import an export produced by the previous version and confirm it migrates

---

## Accessibility verification record

§15.8 asks for a dated record naming the reader-and-browser combination used.
Newest first. An entry is only complete when every flow in it has a verdict.

### 2026-08-18 — T35, the composed surface

**Status: the interface built in T27–T35 was verified as one surface. The
screen-reader spot check is still the one outstanding item, unchanged.**

The point of doing this once at the end rather than five times along the way:
`prefers-reduced-motion` and `forced-colors` are properties of the *composed*
page, and five tasks each honouring them individually can still compose into a
page that does not. Two new scripts, both against the production build served
the way Pages serves it:

| Pass | Checks | Result |
|---|---|---|
| `a11y:manual` | 43 | **pass, unchanged** — the reveal and the restyle cost none of §15's semantics |
| `a11y:reduced-motion` | 12 | **pass** — six animations enumerated by name |
| `a11y:forced-colors` | 10 | **pass** — four of §4.6's five states reached live |

**Environment.** Chromium via Playwright 1.62.1, 1280×900, against
`npm run build` with `404.html` as the SPA fallback.

**What the reduced-motion audit covers, and what it deliberately does not.** It
reads computed styles and class names, unlike `a11y:manual` — a media-feature
audit is a claim about rendering and there is no accessible-name form of "this
element is still transitioning". Both halves of §15.5 are asserted: the motion
is gone, and its information is still present (the camera fly's destination is
still announced in words; the tree camera's anchor is still reflected as
`data-camera-anchor`).

**The reveal is the one animation that is skipped rather than instant.** It is
gated in script, before a frame is ever requested, so there is no transition to
zero out — which is why the audit samples across the whole window it would have
occupied instead of checking once after it would have finished.

**Not reached live by the forced-colors script: `bonus`.** It drives placement
and a dismissal, which renders `complete`, `available`, `locked` and
`dismissed`; the surplus-completion state needs a tree state the script does not
build. It is covered only by the glyph-library check, and the script says so in
its own summary rather than reporting five where it saw four.

### 2026-08-15 — the keyboard pass, driven; screen readers still outstanding

**Status: the keyboard half of §15.8 is complete for all four flows. The
screen-reader spot check is NOT done and is not claimed.**

| Flow | Keyboard-only | Screen reader | Note |
|---|---|---|---|
| Browse | **pass** | not run | Map → Library → skill, Tab and Enter only. |
| Place | **pass** | not run | T15 has landed; §15.6 is reachable and was driven. |
| Complete | **pass** | not run | Full §15.2 key table, panel open/close, live region. |
| Export | **pass** | not run | T16 has landed; export produced a real file from `Enter`. |

**Environment.** Chromium 151.0.7922.34 via Playwright 1.62.1, driving the
production build (`npm run build`) served the way GitHub Pages serves it, with
`404.html` as the SPA fallback — so the `/s/<tree>` routes were exercised through
the same fallback path they take in production, not through the dev server.
Wide pass at 1280×900, narrow at 390×844.

**Reproduce with `npm run a11y:manual --workspace app`** after a build. 43
checks; the script exits non-zero on any failure and prints a per-flow summary.
It asserts **roles and accessible names only** — no CSS selector, no pixel
measurement, no screenshot — so it survives a restyle and fails only when the
§15 semantics actually change, which is the property that makes it worth keeping
across the UI work that follows.

**What it found.** Two defects, both fixed in this pass, and both invisible to
the axe gate for the same structural reason:

- **`/s/<tree>` and `/s/<tree>/m/<slug>` had no `<title>`** — WCAG 2.4.2, level
  A, on the two most-visited routes in the app. Every other route set one. Axe
  cannot see this: it runs on components mounted in jsdom, where there is no
  document head to have an opinion about. Fixed in `SkillPage.svelte`, so both
  routes get it from the one component they already share.
- **F29's track and module labels were absent**, which the same run now covers
  positively: piano draws its three track heads, mental-health draws all five
  distinct module labels, and both reach the reader through the node
  description in both viewports.

**Two harness assumptions were wrong and are recorded so they are not
re-litigated.** §15.2's "one shared live region" is the *tree's*, not the
document's — the page also composes an assessment flow, a notice host and a
storage status, each with its own deliberate `role="status"`. And the one
`aria-live="assertive"` on the page is SvelteKit's `#svelte-announcer`, which
states the new page title after a client-side navigation; that is the correct
SPA pattern, not a violation, and removing it would leave a reader with no
notification that the page changed at all.

**Still outstanding: the screen-reader spot check on one desktop and one mobile
reader.** The run above reads the accessibility tree, which is the data a reader
consumes, but not its behaviour over that tree — browse-mode versus focus-mode
differences, rotor navigation, what actually gets interrupted, and whether the
announcement lands before the focus move are none of them derivable from a
snapshot. **T20 stays open on this item alone.**

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

> **Superseded 2026-08-15.** T15 and T16 have since landed, so the two "not
> possible yet" rows were stale; all four flows were driven in the entry above.
> The keyboard column is now complete and the screen-reader column is not.

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
