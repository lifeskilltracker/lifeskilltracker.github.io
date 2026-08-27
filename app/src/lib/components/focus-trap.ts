/**
 * The focus cycle a modal dialogue owes the keyboard (§15.3, WCAG 2.4.3/2.1.2).
 *
 * Extracted when §6.5's welcome cartouche became the application's second modal
 * dialogue. The first, `Info`, carried this inline; two hand-rolled traps drift,
 * and a trap that drifts fails silently — the dialogue still opens, still reads
 * correctly, and simply lets `Tab` escape to a map the user cannot see.
 *
 * Pure and DOM-only: no framework, no component state. It answers one question —
 * *given this key press, where should focus go* — and the caller does the moving,
 * which is what keeps it assertable without mounting anything.
 */

/**
 * What a browser will stop on inside a dialogue. Deliberately not `*` with a
 * `tabindex` filter: the container itself carries `tabindex="-1"` so it can be
 * focused on open, and it must never become a tab stop of its own.
 */
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function focusableWithin(container: HTMLElement | null): HTMLElement[] {
  return [...(container?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
}

/**
 * The element `Tab` should move to, or `null` to let the browser do its normal
 * thing. Non-null exactly at the two ends of the cycle.
 *
 * The container counts as the leading edge: a dialogue focuses itself on open
 * (so the reader hears its label before its first control), and `Shift+Tab` from
 * there must wrap to the last stop rather than leaving for the page behind.
 */
export function tabTarget(
  container: HTMLElement | null,
  active: Element | null,
  shiftKey: boolean,
): HTMLElement | null {
  const stops = focusableWithin(container);
  if (stops.length === 0) return null;
  const first = stops[0];
  const last = stops[stops.length - 1];

  if (shiftKey && (active === first || active === container)) return last;
  if (!shiftKey && active === last) return first;
  return null;
}
