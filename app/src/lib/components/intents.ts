/**
 * What §9's renderer emits upward (T08).
 *
 * The renderer never writes: §3.2 gives the User State Store the only write
 * path, and §14.1 forbids a component from importing it at all. So a click on
 * "Complete" produces one of these and nothing else — the shell (`lib/actions`)
 * decides what it means for storage.
 *
 * `hide` is here because §11.10 requires the dismissal intercept to offer "hide
 * it instead" as the softer option. **T19 settled what hiding does**: it is a
 * presentation-only suppression held by the session, and it writes no
 * `MilestoneState` at all. That is the whole reason it is a separate intent
 * rather than a second way to reach `dismiss` — §11.10 offers it as the option
 * that avoids the cap, so an implementation that stored a state would hand the
 * user the same catastrophe under a gentler word.
 */

export type MilestoneIntent =
	| { kind: 'complete'; uid: string }
	| { kind: 'dismiss'; uid: string }
	/** Clear the record entirely — un-check, or un-dismiss (§12.2: absence, not a state). */
	| { kind: 'undo'; uid: string }
	| { kind: 'note'; uid: string; note: string }
	/** Suppress from view for this session. Writes nothing (§11.10, T19). */
	| { kind: 'hide'; uid: string }
	/** The reverse of `hide`, and equally free of stored state. */
	| { kind: 'unhide'; uid: string };

/**
 * §11.10's un-check consequence: *"Un-checking this drops Cooking from Level 8
 * to Level 1. Levels 3–8 stay cleared."*
 *
 * Computed by whoever owns the Scoring Engine and handed to the renderer, which
 * only surfaces it — §13.4 keeps the engine out of components, and a component
 * that re-scored a hypothetical would be running one.
 */
export interface UncheckConsequence {
	before: number;
	after: number;
	/** §11.3's satisfied set, which survives the drop — the reason it is tolerable. */
	cleared: number[];
}
