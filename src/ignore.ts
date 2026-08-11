// ignore.ts — filter diagnostics that are known false positives (valid in-game but
// missing from Spyglass's mcdoc schema) or user-supplied --ignore patterns.
// Note: the server renders key names with typographic quotes (“ ”), not ASCII ones.

const BUILTIN_IGNORE_PATTERNS: (string | RegExp)[] = [new RegExp('Unknown key ["“]LastHurtMob["”]')];
export const BUILTIN_IGNORE_DESC = 'Unknown key "LastHurtMob" (missing from Spyglass mcdoc, valid in-game)';

/** Parse a --ignore value: `/regex/` becomes a RegExp, anything else a substring. */
export function parsePattern(p: string): string | RegExp {
  if (p.length > 2 && p.startsWith('/') && p.endsWith('/')) {
    try { return new RegExp(p.slice(1, -1)); } catch { return p; }
  }
  return p;
}

/**
 * Build a predicate over diagnostic messages. `extra` are raw --ignore values
 * (each may be comma-separated). The built-in LastHurtMob pattern is included
 * unless `useIgnore` is false.
 */
export function createIgnoreFilter(opts: { useIgnore: boolean; extra: string[] }): (msg: string) => boolean {
  const extraPatterns = opts.extra
    .flatMap(v => v.split(',').filter(Boolean))
    .map(parsePattern);
  const patterns = opts.useIgnore ? [...BUILTIN_IGNORE_PATTERNS, ...extraPatterns] : extraPatterns;
  return (msg: string): boolean => patterns.some(p => p instanceof RegExp ? p.test(msg) : msg.includes(p));
}
