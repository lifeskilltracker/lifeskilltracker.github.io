/**
 * §9.3's node state table, as data (T08), restated in Survey terms (T34).
 *
 * One row per state, holding the three channels §9.3 and §15.4 require: a glyph
 * id, a border, and a class carrying the fill. **Colour is the only one of the
 * three that lives in CSS** — the other two are attributes on the rendered
 * element, which is what makes them assertable in a test and what makes them
 * survive forced-colours mode, where the fill is thrown away by the platform.
 *
 * `complete` and `bonus` share a solid border by §9.3, so they are separated by
 * glyph rather than by border: a ✓ in a ring for the surplus completion, a plain
 * ✓ for the load-bearing one.
 *
 * **`visualFor` is the single producer of UI-SPEC §4.6's mapping.** T34 restated
 * the table in the Survey vocabulary — plate strengths and ruled border weights
 * rather than "surface" and "solid" — and T31's skill hexes read the *same*
 * function, so the two surfaces cannot drift into two dialects of one encoding.
 * `NodePresentation` below is that mapping rendered into SVG attributes; it is
 * derived rather than written twice.
 */

import type { NodeState } from '$lib/types';

/**
 * UI-SPEC §4.6, verbatim. The meanings and the encoding are **unchanged** from
 * §9.3 — this is a vocabulary, not a redesign, and nothing here adds a sixth
 * meaning to colour (N5).
 *
 * `plate` names a strength, never a hue: §4.3 makes hue identity and forbids it
 * from carrying score, so `full`/`bonus`/`open` say how strongly the *domain's
 * own* plate is inked and never which colour it is.
 */
export type MilestoneVisual = {
	readonly glyph: '✓' | '○' | '‧' | '✕';
	readonly plate: 'full' | 'bonus' | 'open';
	readonly border: 'solid-1.3' | 'solid-2.2' | 'dashed' | 'dotted';
};

export const MILESTONE_VISUAL: Record<NodeState, MilestoneVisual> = {
	complete: { glyph: '✓', plate: 'full', border: 'solid-1.3' },
	bonus: { glyph: '✓', plate: 'bonus', border: 'solid-1.3' },
	// "Solid 2.2, emphasized" (§4.6) — the emphasis is the weight, and it is what
	// the `.` shortcut (§15.2) sends a keyboard user to.
	available: { glyph: '○', plate: 'open', border: 'solid-2.2' },
	locked: { glyph: '‧', plate: 'open', border: 'dashed' },
	// Recessed, but neither hidden nor struck through: "set aside", not "failed" (§9.3).
	dismissed: { glyph: '✕', plate: 'open', border: 'dotted' }
};

/** The §4.6 mapping, and the only place it is stated. T31 consumes this too. */
export function visualFor(state: NodeState): MilestoneVisual {
	return MILESTONE_VISUAL[state];
}

export interface NodePresentation {
	/** `<use href>` target; a real element, never a CSS background (§9.3, §15.4). */
	glyph: string;
	/** `stroke-dasharray` on the node box: solid, dashed, or dotted. */
	dash: string;
	strokeWidth: number;
	/** Fill class; the one channel that is colour. */
	className: string;
	/** §4.6's plate strength, carried through so the renderer states no second table. */
	plate: MilestoneVisual['plate'];
}

/**
 * §4.6's four border kinds as SVG. The two solids differ only in weight, which
 * is why they are two names and not one — "emphasized" has to be a number
 * somewhere, and here is the only somewhere.
 */
const BORDER: Record<MilestoneVisual['border'], { dash: string; strokeWidth: number }> = {
	'solid-1.3': { dash: 'none', strokeWidth: 1.3 },
	'solid-2.2': { dash: 'none', strokeWidth: 2.2 },
	dashed: { dash: '6 4', strokeWidth: 1.3 },
	dotted: { dash: '1 4', strokeWidth: 1.3 }
};

/**
 * The glyph is keyed on the *state*, not on §4.6's character: `complete` and
 * `bonus` are both ✓ and must still be two drawings (a ✓ in a ring for the
 * surplus one), because §15.4 requires the five to survive with the fill thrown
 * away and those two share a border.
 */
function presentation(state: NodeState): NodePresentation {
	const visual = visualFor(state);
	return {
		glyph: `#glyph-${state}`,
		className: `is-${state}`,
		plate: visual.plate,
		...BORDER[visual.border]
	};
}

export const NODE_PRESENTATION: Record<NodeState, NodePresentation> = {
	complete: presentation('complete'),
	bonus: presentation('bonus'),
	available: presentation('available'),
	locked: presentation('locked'),
	dismissed: presentation('dismissed')
};

/** §11.4 leaves a node unstated only if the engine and the bundle disagree. */
export function presentationFor(state: NodeState | undefined): NodePresentation {
	return NODE_PRESENTATION[state ?? 'locked'];
}

/**
 * §4.3's water line for one level band, as a fraction in `[0, 1]`.
 *
 * The level's own groups, averaged — **not** §11.6's `s/(s+k)` curve, which is a
 * domain's fill across many skills and has no meaning inside one level. Averaged
 * rather than reduced to the worst group because the line is orientation, while
 * the *reporting* of which group blocks is §9.6's per-group `n / m` readout,
 * which is drawn beside it and is the channel §15.4 makes load-bearing. The line
 * is therefore never the only statement of level progress, which is what keeps
 * it out of N5's way.
 *
 * Clamped per group, so a `n_of` group ten completions past its threshold (F11's
 * `bonus`) contributes exactly one full group and never pushes a level past
 * full.
 */
export function levelFill(
	groups: readonly { completed: number; n: number }[] | undefined
): number {
	if (groups === undefined || groups.length === 0) return 0;
	const total = groups.reduce(
		(sum, group) => sum + (group.n <= 0 ? 0 : Math.min(group.completed, group.n) / group.n),
		0
	);
	return Math.min(1, total / groups.length);
}

/**
 * §15.7's floor: "for SVG nodes means an invisible hit rectangle larger than the
 * drawn node".
 *
 * The number is in the Layout Engine's abstract units (§8.1), not pixels, and
 * that is the honest reading available here: nothing in the engine or the
 * component knows the rendered scale, since the `viewBox` maps units to pixels
 * at whatever width the container gives. §8.1 sizes a node 100×44 units against
 * a row pitch that keeps the wide layout at roughly 1 unit per pixel, so a
 * rectangle of at least 44 units is at least 44 CSS pixels wherever the wide
 * layout is used at all — and below that width §8.5 substitutes the narrow
 * stack, whose targets are ordinary CSS boxes with a `min-height`.
 */
export const TOUCH_TARGET_MIN = 44;

export interface HitRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * A transparent rectangle centred on the drawn node, never smaller than
 * `TOUCH_TARGET_MIN` on either axis. Centred rather than anchored so growing it
 * cannot push the target off the glyph it belongs to.
 */
export function hitRect(w: number, h: number): HitRect {
	const width = Math.max(w, TOUCH_TARGET_MIN);
	const height = Math.max(h, TOUCH_TARGET_MIN);
	return { x: (w - width) / 2, y: (h - height) / 2, width, height };
}
