/** UTF-8 byte order for deterministic tree-id sorting (ASCII code-point order). */
export function compareAsciiUtf8(a: string, b: string): number {
  return Buffer.from(a, 'utf8').compare(Buffer.from(b, 'utf8'));
}

export function sortByAsciiUtf8<T>(items: T[], key: (item: T) => string): T[] {
  return items.slice().sort((left, right) => compareAsciiUtf8(key(left), key(right)));
}
