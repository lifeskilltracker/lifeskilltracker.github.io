/** Stable JSON bytes for content-hashed bundles (no timestamps). */
export function serializeJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
