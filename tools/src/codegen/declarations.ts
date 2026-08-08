/** Lightweight export-declaration scanner with balanced-delimiter parsing. */

export interface DeclarationRange {
  readonly start: number;
  readonly end: number;
  readonly kind: 'type' | 'interface';
}

function skipWhitespace(source: string, index: number): number {
  let i = index;
  while (i < source.length) {
    if (/\s/.test(source[i] ?? '')) {
      i += 1;
      continue;
    }
    if (source.startsWith('//', i)) {
      i += 2;
      while (i < source.length && source[i] !== '\n') i += 1;
      continue;
    }
    if (source.startsWith('/*', i)) {
      i += 2;
      while (i < source.length && !source.startsWith('*/', i)) i += 1;
      i += 2;
      continue;
    }
    break;
  }
  return i;
}

function findBalancedEnd(
  source: string,
  openIndex: number,
  openChar: '{' | '(' | '[',
  closeChar: '}' | ')' | ']',
): number {
  let depth = 0;
  let i = openIndex;

  while (i < source.length) {
    const ch = source[i];

    if (ch === '"' || ch === "'" || ch === '`') {
      i = skipQuoted(source, i, ch);
      continue;
    }

    if (source.startsWith('//', i)) {
      i += 2;
      while (i < source.length && source[i] !== '\n') i += 1;
      continue;
    }

    if (source.startsWith('/*', i)) {
      i += 2;
      while (i < source.length && !source.startsWith('*/', i)) i += 1;
      i += 2;
      continue;
    }

    if (ch === openChar) depth += 1;
    else if (ch === closeChar) {
      depth -= 1;
      if (depth === 0) return i;
    }

    i += 1;
  }

  throw new Error(`Unbalanced ${openChar} starting at index ${openIndex}`);
}

function skipQuoted(source: string, index: number, quote: string): number {
  let i = index + 1;
  while (i < source.length) {
    if (source[i] === '\\') {
      i += 2;
      continue;
    }
    if (source[i] === quote) return i + 1;
    i += 1;
  }
  throw new Error(`Unterminated string at index ${index}`);
}

function findTypeAliasEnd(source: string, start: number): number {
  let brace = 0;
  let paren = 0;
  let bracket = 0;
  let i = start;

  while (i < source.length) {
    const ch = source[i];

    if (ch === '"' || ch === "'" || ch === '`') {
      i = skipQuoted(source, i, ch);
      continue;
    }

    if (source.startsWith('//', i)) {
      i += 2;
      while (i < source.length && source[i] !== '\n') i += 1;
      continue;
    }

    if (source.startsWith('/*', i)) {
      i += 2;
      while (i < source.length && !source.startsWith('*/', i)) i += 1;
      i += 2;
      continue;
    }

    if (ch === '{') brace += 1;
    else if (ch === '}') brace -= 1;
    else if (ch === '(') paren += 1;
    else if (ch === ')') paren -= 1;
    else if (ch === '[') bracket += 1;
    else if (ch === ']') bracket -= 1;
    else if (ch === ';' && brace === 0 && paren === 0 && bracket === 0) return i + 1;

    i += 1;
  }

  throw new Error(`Unterminated type alias at index ${start}`);
}

export function findExportDeclaration(source: string, name: string): DeclarationRange | null {
  const pattern = new RegExp(`export\\s+(type|interface)\\s+${name}\\b`);
  const match = pattern.exec(source);
  if (!match) return null;

  const kind = match[1] as 'type' | 'interface';
  const start = match.index;
  let pos = skipWhitespace(source, match.index + match[0].length);

  if (kind === 'interface') {
    if (source[pos] !== '{') return null;
    const end = findBalancedEnd(source, pos, '{', '}') + 1;
    return { start, end, kind };
  }

  if (source[pos] !== '=') return null;
  pos = skipWhitespace(source, pos + 1);
  const end = findTypeAliasEnd(source, pos);
  return { start, end, kind };
}

export function getExportDeclarationText(source: string, name: string): string | null {
  const range = findExportDeclaration(source, name);
  if (!range) return null;
  return source.slice(range.start, range.end);
}

export function replaceExportDeclaration(source: string, name: string, replacement: string): string {
  const range = findExportDeclaration(source, name);
  if (!range) {
    throw new Error(`export declaration "${name}" not found`);
  }
  return source.slice(0, range.start) + replacement.trimEnd() + source.slice(range.end);
}

/** Extract the closed payload from jsts open-intersection roots: `{ [k: string]: … } & { BODY }`. */
export function extractClosedIntersectionBody(typeAliasText: string): string | null {
  const eq = typeAliasText.indexOf('=');
  if (eq === -1) return null;

  const rhs = typeAliasText.slice(eq + 1).trim();
  const openIndex = rhs.search(/\{\s*\[k: string\]:/);
  if (openIndex === -1) return null;

  const amp = rhs.indexOf('&', openIndex);
  if (amp === -1) return null;

  const pos = skipWhitespace(rhs, amp + 1);
  if (rhs[pos] !== '{') return null;
  const end = findBalancedEnd(rhs, pos, '{', '}');
  return rhs.slice(pos + 1, end).trim();
}

export function hasOpenIndexSignature(declarationText: string): boolean {
  return /\[\s*k\s*:\s*string\s*\]\s*:\s*(?:any|unknown)/.test(declarationText);
}
