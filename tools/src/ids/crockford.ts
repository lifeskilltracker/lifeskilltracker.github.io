import { randomFillSync } from 'node:crypto';

export const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export const UID_PATTERN = /^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{8}$/;

export function isValidUid(value: string): boolean {
  return value.length > 0 && UID_PATTERN.test(value);
}

export function generateCrockfordUid(existing: ReadonlySet<string>): string {
  const bytes = new Uint8Array(5);
  for (let attempt = 0; attempt < 10_000; attempt += 1) {
    randomFillSync(bytes);
    let uid = '';
    let buffer = 0;
    let bits = 0;
    for (const byte of bytes) {
      buffer = (buffer << 8) | byte;
      bits += 8;
      while (bits >= 5 && uid.length < 8) {
        bits -= 5;
        const index = (buffer >> bits) & 31;
        uid += CROCKFORD_ALPHABET[index];
      }
    }
    while (uid.length < 8) {
      bits -= 5;
      const index = (buffer >> bits) & 31;
      uid += CROCKFORD_ALPHABET[index];
    }
    if (!existing.has(uid)) {
      return uid;
    }
  }
  throw new Error('failed to generate a unique Crockford uid after 10000 attempts');
}
