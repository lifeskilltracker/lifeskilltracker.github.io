/**
 * §12.7's durability message, in one place (T18).
 *
 * It lives in `lib/components` rather than beside the trigger logic because
 * §14.1 forbids a component from importing `lib/state`, and this is copy — the
 * sentence the user reads — rather than a fact about stored state. The triggers
 * decide *whether* to say something; this is *what* is said, and the two change
 * for different reasons.
 *
 * **Factual rather than alarming**, and specifically about backup rather than
 * about space. §17.4 puts a phase 1 heavy user under 1 MB against quotas
 * measured in hundreds of megabytes, so copy implying "running out of room"
 * would be false as well as frightening — §12.7's prompting is about eviction,
 * not exhaustion.
 *
 * It names the three ways the data goes, because R-18 accepts all three and
 * F39's export is the only answer to any of them: the browser reclaiming space,
 * a private-browsing session ending, and the user clearing their own browsing
 * data. `ExportPrompt.test.ts` asserts exactly that, in one readable assertion,
 * which is why the wording is a constant and not markup.
 */

export const DURABILITY_MESSAGE =
  'Everything you record is stored in this browser on this device. It can be cleared by ' +
  'the browser to reclaim space, it does not survive a private-browsing session, and it ' +
  'goes when you clear your browsing data. An export is the only backup there is.';
