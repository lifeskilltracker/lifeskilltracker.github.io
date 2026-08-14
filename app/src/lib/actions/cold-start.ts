/**
 * §13.3's cold-start sequence, in full (T14).
 *
 * It lives in `lib/actions` because it is the one sequence that needs both I/O
 * owners and neither may call the other (§14.1). `bootstrapUserState` beside it
 * is the hydration half alone, kept because T10's Phase 0 gate is written
 * against it.
 *
 * Three properties are worth stating, because each is a way this could be
 * written that renders correctly and is wrong:
 *
 * **The two halves run in parallel and are settled, not awaited in sequence.**
 * §13.3 step 2 is a `‖`, and `Promise.allSettled` is what lets a hydration
 * rejection be *inspected* rather than thrown past the manifest. A `Promise.all`
 * here would discard a perfectly good manifest because IndexedDB was
 * unavailable, turning a degraded session into a dead one.
 *
 * **`applyMoves` runs only when hydration succeeded, and before the caller
 * derives anything.** It is a write, and §13.3 skips every write when hydration
 * failed. It rewrites `MILESTONE.treeId`, which is the key `progressFor` reads
 * on — so running it after the map derived would leave a re-homed record counted
 * under its old domain for the first frame (§12.5, T26/F13).
 *
 * **A failure is a value, never an exception.** A caller that cannot see
 * `hydrated: false` is the "read as empty, then wrote" bug §13.3 exists to
 * prevent, so the shell is handed something it has to look at.
 */

import type { ContentLoader } from '$lib/content';
import { NotImplementedHereError, type UserStateStore } from '$lib/state/store.js';
import type { Manifest, MigrationReport } from '$lib/types';

export type ColdStartContent = Pick<ContentLoader, 'loadManifest' | 'isOffline'>;
export type ColdStartStore = Pick<UserStateStore, 'hydrate' | 'applyMoves' | 'hydrated'>;

interface ColdStartCommon {
	/** False when hydration rejected — §13.3's read-only session. */
	readonly hydrated: boolean;
	/** Present exactly when `hydrated` is false. */
	readonly hydrationError?: string;
}

export interface ColdStartReady extends ColdStartCommon {
	readonly kind: 'ready';
	readonly manifest: Manifest;
	/** Serving a cached manifest we could not revalidate (§7.4, §16.3 row 1). */
	readonly offline: boolean;
	/** §12.5's summaries for the re-homed records, for T17's migration surface. */
	readonly migrations: readonly MigrationReport[];
	/** `applyMoves` itself failed; the session continues without it. */
	readonly movesError?: string;
}

/** §16.3 row 2: no manifest and no cache. There is nothing to render. */
export interface ColdStartFailed extends ColdStartCommon {
	readonly kind: 'failed';
	readonly reason: string;
}

export type ColdStart = ColdStartReady | ColdStartFailed;

const messageOf = (error: unknown): string =>
	error instanceof Error ? error.message : String(error);

/**
 * T17 owns `applyMoves` (§12.5) and may not have landed. A missing
 * implementation is not a failed start — the deliberately edgeless dependency
 * noted in `_BREAKDOWN.yaml` — so it resolves to no migrations. Any *other*
 * failure is reported, because a `moved` map that was meant to run and did not
 * leaves records under the wrong tree, and the user should be told.
 */
async function applyMoves(
	store: ColdStartStore,
	moved: Manifest['moved']
): Promise<{ migrations: readonly MigrationReport[]; error?: string }> {
	try {
		return { migrations: await store.applyMoves(moved) };
	} catch (error) {
		if (error instanceof NotImplementedHereError) return { migrations: [] };
		return { migrations: [], error: messageOf(error) };
	}
}

export async function coldStart(
	content: ColdStartContent,
	store: ColdStartStore
): Promise<ColdStart> {
	// Step 2 — in parallel, and settled so neither failure hides the other.
	const [manifest, hydration] = await Promise.allSettled([
		content.loadManifest(),
		store.hydrate()
	]);

	// `store.hydrated` rather than the promise alone: the store is the authority
	// on whether the mirror holds what IndexedDB holds (§14.5, T26/F23).
	const hydrated = hydration.status === 'fulfilled' && store.hydrated;
	const hydrationError =
		hydration.status === 'rejected'
			? { hydrationError: messageOf(hydration.reason) }
			: hydrated
				? {}
				: { hydrationError: 'the user state store did not report itself hydrated' };

	if (manifest.status === 'rejected') {
		// The loader already served a cached manifest if it had one (§7.4), so a
		// rejection here means there was none: §16.3's cold-start failure screen.
		return { kind: 'failed', reason: messageOf(manifest.reason), hydrated, ...hydrationError };
	}

	// Step 3 — the write, before anything derives. Skipped with every other
	// write when hydration failed.
	const moves = hydrated
		? await applyMoves(store, manifest.value.moved)
		: { migrations: [] as readonly MigrationReport[] };

	return {
		kind: 'ready',
		manifest: manifest.value,
		offline: content.isOffline(),
		hydrated,
		migrations: moves.migrations,
		...(moves.error === undefined ? {} : { movesError: moves.error }),
		...hydrationError
	};
}
