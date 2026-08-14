/**
 * §15.8's axe gate (T20).
 *
 * "Axe via `vitest-axe` on component tests as a CI gate; automated checks catch
 * roughly a third of real issues, so they gate but do not certify." The second
 * half of that sentence is why this file is small and why the manual items in
 * `docs/RELEASE-CHECKLIST.md` are load-bearing rather than optional: a green run
 * here means no *machine-detectable* violation, and nothing more.
 *
 * **Scoped to WCAG 2.1 A and AA**, deliberately. axe's default run includes its
 * best-practice rules, and one of them — `region`, which wants every node inside
 * a landmark — fires on every component tested in isolation, because a component
 * is not a page. A gate that has to be suppressed at each call site stops being a
 * gate; the conformance tags are the line the project is actually holding.
 *
 * The result is asserted by hand rather than through `vitest-axe`'s matcher: the
 * matcher needs `expect` augmented by a global setup file, and the failure
 * message here can name the rule and the element instead.
 */

import { axe } from 'vitest-axe';

const WCAG_21_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/**
 * Runs axe over `container` and throws with every violation spelled out.
 * Returns the rule ids it found nothing wrong with, so a test can assert the run
 * actually exercised something rather than silently passing on an empty subtree.
 */
export async function auditAccessibility(container: Element): Promise<string[]> {
  const results = await axe(container, {
    runOnly: { type: 'tag', values: WCAG_21_AA },
    // `color-contrast` needs a rendering engine to sample pixels and jsdom has
    // none — it reaches for `<canvas>` and gives up. Leaving it on would print a
    // "not implemented" warning per run and still check nothing. Contrast is a
    // palette question, which §15.9 leaves to product (D19), and it is on the
    // manual list in `docs/RELEASE-CHECKLIST.md`.
    rules: { 'color-contrast': { enabled: false } },
  });

  if (results.violations.length > 0) {
    const detail = results.violations
      .map((violation) => {
        const where = violation.nodes.map((node) => node.html).join('\n      ');
        return `  ${violation.id} (${violation.impact}): ${violation.help}\n      ${where}`;
      })
      .join('\n');
    throw new Error(`axe found ${results.violations.length} violation(s):\n${detail}`);
  }

  return results.passes.map((pass) => pass.id);
}
