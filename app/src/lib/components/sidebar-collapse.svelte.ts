/**
 * §6.1's collapsed state, persisted locally (T32).
 *
 * Modelled on `lib/styles/theme.svelte.ts` rather than on §13.2's mirror, and
 * for the same reason: this is a **chrome preference**, not user data. It never
 * enters an export, it is per-device by design, and losing it costs a click. So
 * it lives in `localStorage` behind a `try`/`catch` — private mode and blocked
 * storage both throw, and a sidebar is not worth failing a start over.
 *
 * It sits in `lib/components` rather than `lib/state` deliberately. §14.1 makes
 * `lib/state` "the only user-data writer" and forbids components from importing
 * it; widening that module to hold a chrome toggle would either break the rule
 * or dilute the sentence that makes it checkable.
 *
 * **Module-level, not component-level.** `/` and `/d/<domainId>` share the
 * layout but a client-side navigation can still tear a component down, and a
 * sidebar that sprang back open on a route change would be a preference the user
 * has to keep re-stating.
 */

const STORAGE_KEY = 'lst.sidebar.collapsed';

let collapsed = $state(false);

function write(value: boolean): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, value ? '1' : '0');
  } catch {
    // A blocked store costs persistence, not the session.
  }
}

export const sidebarCollapse = {
  get collapsed(): boolean {
    return collapsed;
  },
  set(value: boolean): void {
    collapsed = value;
    write(value);
  },
  toggle(): void {
    sidebarCollapse.set(!collapsed);
  },
};

/**
 * Read the stored choice. Called from an effect rather than at module scope:
 * module scope also runs during the prerender pass, where there is no
 * `localStorage` and the answer would be a hard-coded `false` baked into eight
 * static documents.
 */
export function initSidebarCollapse(): void {
  try {
    collapsed = globalThis.localStorage?.getItem(STORAGE_KEY) === '1';
  } catch {
    collapsed = false;
  }
}
