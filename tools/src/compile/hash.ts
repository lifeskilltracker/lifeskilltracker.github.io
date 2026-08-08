import { createHash } from 'node:crypto';

/** First 8 hex chars of SHA-256 over UTF-8 JSON bytes — §7.1 content-hash filenames. */
export function contentHash(json: string): string {
  return createHash('sha256').update(json, 'utf8').digest('hex').slice(0, 8);
}

export function bundleFilename(treeId: string, hash: string): string {
  return `${treeId}.${hash}.json`;
}

export function bundleRelativePath(treeId: string, hash: string): string {
  return `trees/${bundleFilename(treeId, hash)}`;
}
