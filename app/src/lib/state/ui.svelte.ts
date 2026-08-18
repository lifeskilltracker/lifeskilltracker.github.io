/**
 * §13.2's third rune store — viewport class, panel state, and transient notices.
 *
 * It holds no user data and no content. That is what lets it live in
 * `lib/state` beside the mirror without widening what "the only user-data
 * writer" means: nothing here is persisted, and a reload discards all of it.
 *
 * **Panel state is here rather than inside `TreeView` because a URL owns it.**
 * §13.1 makes `/s/<treeId>/m/<slug>` a real route, so the open panel is
 * addressable, and a component holding that state privately would mean the deep
 * link and the panel could disagree. The route writes it; the renderer binds to
 * it.
 *
 * **Notices are transient by construction** — an array with no persistence and
 * no id scheme beyond a counter. §16.3's loud surfaces (a hydration failure, an
 * unresolvable slug, a tree that is not in the manifest) are the whole
 * clientele, and every one of them is a statement about *this session*.
 */

export type NoticeKind = 'info' | 'warning' | 'error';

export interface Notice {
  readonly id: number;
  readonly kind: NoticeKind;
  readonly text: string;
  /** A machine-ish detail line — an error message, a tree id (§16.5). */
  readonly detail?: string;
}

/** Which milestone panel is open, and in which tree (§13.1, §9.4). */
export interface PanelState {
  readonly treeId: string;
  readonly uid: string;
}

class UiState {
  /**
   * The shell's own class. The tree and the map each measure their **own**
   * container rather than reading this (§9.5, §10.7, §15.7) — the same
   * component has to behave correctly inside a narrow panel on a wide screen.
   * What this drives is chrome: the nav, and copy that talks about the window.
   */
  viewport = $state<'wide' | 'narrow'>('wide');

  panel = $state<PanelState | null>(null);

  notices = $state<Notice[]>([]);

  /**
   * §6.4 — whether the next-step card has been dismissed (T32).
   *
   * Here, and deliberately **not** in `localStorage` or `sessionStorage`. The
   * spec's two failure modes pull in opposite directions: a card that comes back
   * mid-session is an interruption, and one that never comes back is a feature
   * the user loses by accident. Module-level state is exactly the scope between
   * them — it survives every client-side navigation between `/` and
   * `/d/<domainId>`, and a reload discards it. `sessionStorage` would survive the
   * reload too, which is the wrong answer.
   */
  nextStepDismissed = $state(false);

  #nextId = 1;

  openPanel(treeId: string, uid: string): void {
    this.panel = { treeId, uid };
  }

  closePanel(): void {
    this.panel = null;
  }

  /** Returns the id so a caller that owns a notice can retract it. */
  notify(kind: NoticeKind, text: string, detail?: string): number {
    const id = this.#nextId++;
    this.notices = [
      ...this.notices,
      { id, kind, text, ...(detail === undefined ? {} : { detail }) },
    ];
    return id;
  }

  dismiss(id: number): void {
    this.notices = this.notices.filter((notice) => notice.id !== id);
  }

  /** Test seam: a fresh shell between cases. */
  reset(): void {
    this.viewport = 'wide';
    this.panel = null;
    this.notices = [];
    this.nextStepDismissed = false;
    this.#nextId = 1;
  }
}

export const ui = new UiState();
