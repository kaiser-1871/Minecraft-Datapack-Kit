// ignore.ts — filter diagnostics that are known false positives (valid in-game but
// missing from Spyglass's mcdoc schema) or user-supplied --ignore patterns.
// Note: the server renders key names with typographic quotes (“ ”), not ASCII ones.

const BUILTIN_IGNORE_PATTERNS: (string | RegExp)[] = [new RegExp('Unknown key ["“]LastHurtMob["”]')];
export const BUILTIN_IGNORE_DESC = 'Unknown key "LastHurtMob" (missing from Spyglass mcdoc, valid in-game)';

/**
 * True when a diagnostic is the "Cannot find <registry> "<id>"" undeclared-symbol linter
 * firing on a *vanilla* registry ID or tag that the datapack simply doesn't declare — i.e. a
 * known false positive, not a typo.
 *
 * Registry IDs: must be exactly present in the version's registry values (data-driven: what's
 * vanilla in 26.2 may be custom in 1.21 and vice versa — e.g. 1.21.1 stores
 * "generic.attack_speed", 26.2 stores "attack_speed"), in the minecraft: namespace.
 * Tags ("Cannot find tag/<reg> "minecraft:<tag>""): must be in the version's vanilla tag set
 * (from the cached vanilla-data tarball), when that data is available.
 *
 * Anything else (custom namespace, category we have no data for, typo, tag data missing) →
 * false, so the diagnostic is kept. Both engines emit English diagnostics (LSP sends
 * locale:'en'; inproc never calls loadLocale), so the "Cannot find " prefix guard is stable;
 * if it ever changed, this feature degrades to no-op rather than mis-parsing localized text.
 */
export function isVanillaRegistryMiss(
  msg: string,
  registries: Record<string, string[]>,
  vanillaTags?: Set<string> | null | (() => Set<string> | null),
): boolean {
  // Real messages carry a trailing " (rule: undeclaredSymbol)" suffix, so no end anchor.
  const m = msg.match(/^Cannot find (\S+) [“"]([^”"]+)[”"]/);
  if (!m) return false;
  const category = m[1];
  const id = m[2];
  if (id.startsWith('#')) return false;
  // vanilla tag reference: category is "tag/<registry>". The tag set is only resolved
  // (and the vanilla-data tarball only decompressed) once a tag-miss diagnostic actually
  // appears — packs without tag misses pay nothing.
  if (category.startsWith('tag/')) {
    const tags = typeof vanillaTags === 'function' ? vanillaTags() : vanillaTags;
    if (!tags) return false;
    const reg = category.slice('tag/'.length);
    if (!id.startsWith('minecraft:')) return false;
    const tag = id.slice('minecraft:'.length);
    return tags.has(`${reg}/${tag}`);
  }
  const values = registries[category];
  if (!values) return false;
  const bare = id.startsWith('minecraft:') ? id.slice('minecraft:'.length) : id;
  if (bare.includes(':')) return false; // custom namespace: cannot be a vanilla miss
  return values.includes(bare);
}

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
