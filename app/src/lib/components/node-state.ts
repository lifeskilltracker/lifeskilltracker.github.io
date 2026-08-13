/**
 * §9.3's node state table, as data (T08).
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
 */

import type { NodeState } from '$lib/types';

export interface NodePresentation {
	/** `<use href>` target; a real element, never a CSS background (§9.3, §15.4). */
	glyph: string;
	/** `stroke-dasharray` on the node box: solid, dashed, or dotted. */
	dash: string;
	strokeWidth: number;
	/** Fill class; the one channel that is colour. */
	className: string;
}

export const NODE_PRESENTATION: Record<NodeState, NodePresentation> = {
	complete: { glyph: '#glyph-complete', dash: 'none', strokeWidth: 1.5, className: 'is-complete' },
	bonus: { glyph: '#glyph-bonus', dash: 'none', strokeWidth: 1.5, className: 'is-bonus' },
	// "Solid, emphasized" (§9.3) — the emphasis is the weight, and it is what the
	// `.` shortcut (§15.2) sends a keyboard user to.
	available: { glyph: '#glyph-available', dash: 'none', strokeWidth: 3, className: 'is-available' },
	locked: { glyph: '#glyph-locked', dash: '6 4', strokeWidth: 1, className: 'is-locked' },
	// Recessed, but neither hidden nor struck through: "set aside", not "failed" (§9.3).
	dismissed: { glyph: '#glyph-dismissed', dash: '1 4', strokeWidth: 1, className: 'is-dismissed' }
};

/** §11.4 leaves a node unstated only if the engine and the bundle disagree. */
export function presentationFor(state: NodeState | undefined): NodePresentation {
	return NODE_PRESENTATION[state ?? 'locked'];
}
