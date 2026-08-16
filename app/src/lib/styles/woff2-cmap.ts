/**
 * A minimal woff2 reader, enough to answer one question: which codepoints can this
 * subset actually draw?
 *
 * It exists because §4.5's glyph set is closed and `font-coverage.test.ts` has to
 * check the font against the *content* rather than against a list someone typed. A
 * missing glyph has no error path — the browser silently falls back to Palatino for
 * that one label — so the only place it can be caught is a test that reads the cmap.
 *
 * This is test-only and deliberately partial: it reads the table directory and the
 * character map, and it does not reconstruct `glyf`/`loca`. woff2 stores its tables
 * as one Brotli stream, which Node can decode natively; no dependency is added.
 *
 * Spec: https://www.w3.org/TR/WOFF2/
 */

import { brotliDecompressSync } from 'node:zlib';

/** WOFF2 §5.2 — the 63 tags a one-byte flag can name by index. */
const KNOWN_TAGS = [
  'cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm',
  'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern',
  'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC',
  'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar',
  'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty',
  'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat',
  'Gloc', 'Feat', 'Sill',
];

/** WOFF2 §4 — a base-128 integer, most significant group first. */
function readBase128(buffer: Buffer, offset: number): { value: number; next: number } {
  let value = 0;
  for (let i = 0; i < 5; i += 1) {
    const byte = buffer[offset + i];
    if (i === 0 && byte === 0x80) throw new Error('woff2: leading zero in UIntBase128');
    value = value * 128 + (byte & 0x7f);
    if ((byte & 0x80) === 0) return { value, next: offset + i + 1 };
  }
  throw new Error('woff2: UIntBase128 too long');
}

interface TableEntry {
  tag: string;
  length: number;
}

function readDirectory(buffer: Buffer, numTables: number): { tables: TableEntry[]; next: number } {
  const tables: TableEntry[] = [];
  let offset = 48;
  for (let i = 0; i < numTables; i += 1) {
    const flags = buffer[offset];
    offset += 1;
    const index = flags & 0x3f;
    let tag: string;
    if (index === 0x3f) {
      tag = buffer.subarray(offset, offset + 4).toString('latin1');
      offset += 4;
    } else {
      tag = KNOWN_TAGS[index];
    }
    const original = readBase128(buffer, offset);
    offset = original.next;

    // A transform length is present only when a transform is actually applied.
    // For glyf/loca the null transform is version 3; for every other table it is
    // version 0. Getting this wrong desynchronises every later table offset.
    const version = (flags >> 6) & 0x03;
    const transformed = tag === 'glyf' || tag === 'loca' ? version !== 3 : version !== 0;
    let length = original.value;
    if (transformed) {
      const transform = readBase128(buffer, offset);
      offset = transform.next;
      length = transform.value;
    }
    tables.push({ tag, length });
  }
  return { tables, next: offset };
}

function parseCmapSubtable(cmap: Buffer, offset: number, out: Set<number>): void {
  const format = cmap.readUInt16BE(offset);
  if (format === 4) {
    const segCountX2 = cmap.readUInt16BE(offset + 6);
    const segCount = segCountX2 / 2;
    const endBase = offset + 14;
    const startBase = endBase + segCountX2 + 2;
    for (let segment = 0; segment < segCount; segment += 1) {
      const end = cmap.readUInt16BE(endBase + segment * 2);
      const start = cmap.readUInt16BE(startBase + segment * 2);
      if (start === 0xffff) continue;
      for (let code = start; code <= end && code !== 0x10000; code += 1) out.add(code);
    }
    return;
  }
  if (format === 12) {
    const groups = cmap.readUInt32BE(offset + 12);
    for (let group = 0; group < groups; group += 1) {
      const base = offset + 16 + group * 12;
      const start = cmap.readUInt32BE(base);
      const end = cmap.readUInt32BE(base + 4);
      for (let code = start; code <= end; code += 1) out.add(code);
    }
  }
}

/** The codepoints the font declares it can draw. */
export function woff2Codepoints(font: Buffer): Set<number> {
  if (font.subarray(0, 4).toString('latin1') !== 'wOF2') throw new Error('not a woff2 file');
  if (font.readUInt32BE(8) !== font.length) throw new Error('woff2: declared length mismatch');

  const numTables = font.readUInt16BE(12);
  const { tables, next } = readDirectory(font, numTables);
  const decoded = brotliDecompressSync(font.subarray(next));

  let cursor = 0;
  let cmap: Buffer | null = null;
  for (const table of tables) {
    if (table.tag === 'cmap') cmap = decoded.subarray(cursor, cursor + table.length);
    // No padding here. The 4-byte alignment belongs to the reconstructed sfnt;
    // inside the compressed stream the tables are contiguous, and assuming
    // otherwise desynchronises every table after the first odd-length one.
    cursor += table.length;
  }
  if (cmap === null) throw new Error('woff2: no cmap table');

  const out = new Set<number>();
  const encodings = cmap.readUInt16BE(2);
  for (let i = 0; i < encodings; i += 1) {
    const offset = cmap.readUInt32BE(4 + i * 8 + 4);
    parseCmapSubtable(cmap, offset, out);
  }
  return out;
}
