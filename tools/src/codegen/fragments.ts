/** Static canonical fragments not derived from conditional schema shapes. */

export const AXIAL_TILE = 'export type AxialTile = [number, number];';

export const COMPILED_MASTERY_REQUIRES_REF = `/** Compiled prerequisite reference for mastery entries (§5.7). */
export interface MasteryRequiresRef {
  kind: 'milestone' | 'achievement';
  /** Index into CompiledTree.milestones when kind is milestone, or CompiledTree.mastery when kind is achievement. */
  index: number;
  slug: string;
}`;
