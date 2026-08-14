/**
 * Cold start, the Phase 0 subset (§13.3) — T10.
 *
 * §13.3's full sequence is **T14's**: `applyMoves`, the version-gated
 * `applyLineage`, the notice host, and the offline branch. One step of it is
 * needed before the Phase 0 gate can pass, because §16.4's exit criteria
 * require a completion to survive a page reload and nothing else calls
 * `hydrate()`. Without it the records sit in IndexedDB while §13.2's mirror
 * starts empty, so a reloaded tree renders as though nothing was ever done.
 *
 * It resolves rather than throws. §13.3 makes a hydration failure a *degraded
 * session*, not a dead one — the store latches itself unwritable and the shell
 * keeps rendering content, which is the whole point of a system whose content
 * is re-fetchable and whose user data is not (§16.5, R-15). A caller that
 * cannot tell hydration failed is the "read as empty, then wrote" bug, so the
 * failure is returned as a value the shell has to look at.
 */

import { store as defaultStore } from '$lib/state/store.js';

export interface BootstrapStatus {
	/** True only when §13.2's mirror actually holds what IndexedDB holds. */
	readonly hydrated: boolean;
	/** Present exactly when `hydrated` is false. */
	readonly error?: string;
}

type Hydratable = Pick<typeof defaultStore, 'hydrate' | 'hydrated'>;

export async function bootstrapUserState(
	store: Hydratable = defaultStore
): Promise<BootstrapStatus> {
	try {
		await store.hydrate();
		return { hydrated: store.hydrated };
	} catch (error) {
		// The store has already latched `writable` false for the session; this
		// only carries the reason up to whoever renders the degraded state.
		return { hydrated: false, error: error instanceof Error ? error.message : String(error) };
	}
}
