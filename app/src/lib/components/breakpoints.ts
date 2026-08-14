/**
 * §15.7's three thresholds, in one module (T20).
 *
 * The section names exactly three, and before this file each lived beside the
 * thing it happened to affect — which is how a responsive contract stated as
 * "three thresholds" becomes three unrelated numbers nobody can check against
 * the spec. None of them is normative; they are tunable data, like §8.1's units.
 *
 * **All three are measured against a container, never the viewport.** Two of them
 * choose *data* — which layout the engine is asked for, and whether the map is
 * drawn at all — so they are read by a `ResizeObserver` on the component's own
 * box rather than by a CSS `@container` rule: the decision has to reach
 * TypeScript, and a media query would make a component behave by where the
 * window is rather than by how much room it was given. The third is presentation
 * only and *is* a CSS `@container` rule, in `TreeView.svelte`.
 */

/** §8.5 — below this, the tree collapses to one column per level. */
export const TREE_NARROW_BELOW = 720;

/**
 * §10.7 — below this, the map is replaced by the domain list. There is no pan
 * and no zoom, so past the point where the labels stop being legible the honest
 * thing is a list (§15.3 requires it to be the same content in the same order).
 */
export const MAP_LIST_BELOW = 560;

/**
 * §15.7 — below this, the milestone detail moves from a side panel to a
 * full-screen sheet. The only one of the three that is pure CSS, so the number
 * is also written as a literal in `TreeView.svelte`'s `@container` rule;
 * `TreeView.a11y.test.ts` asserts the two agree, because a container query
 * cannot read a TypeScript constant.
 */
export const PANEL_SHEET_BELOW = 560;
