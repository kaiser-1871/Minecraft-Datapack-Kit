// collect.ts — walk a datapack's data/ directory (and pack.mcmeta overlay data dirs) for
// checkable files and apply the --files glob filter. Paths are made relative to data/ so
// --files=<ns>/... reads naturally; overlay files get an @overlay:<dir>/ prefix in the rel so
// they never collide with the root pack's files of the same id.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { OVERLAY_REL_PREFIX, dataRelOf } from './datapack-structure.js';

export const FILES_EMPTY_HINT = '[check] --files is matched relative to data/ — try e.g. test/function/*.mcfunction';

/** Normalize an absolute file path to a data/-relative path with forward slashes. */
export function toRel(filePath: string, dataDir: string): string {
  return filePath.slice(dataDir.length + 1).replace(/\\/g, '/');
}

const CHECKABLE = (name: string): boolean =>
  name.endsWith('.mcfunction') ||
  name.endsWith('.json') && !name.startsWith('.') ||
  name.endsWith('.nbt');

/** An unreadable directory found while walking data/ (surfaced instead of silently skipped). */
export interface UnreadableDir {
  /** Absolute filesystem path of the directory. */
  path: string;
  /** data/-relative path (with @overlay:<dir>/ prefix for overlays); empty = data/ itself. */
  rel: string;
  /** The underlying filesystem error message. */
  error: string;
}

/**
 * Collect all checkable files under a datapack:
 *   data/** / *.mcfunction | *.json (non-dotfile) | *.nbt
 * plus every overlay data/ directory declared in pack.mcmeta. `only` is a data/-relative glob
 * (matched against the path without the overlay prefix). `onUnreadable`, when supplied, receives
 * directories that exist but could not be listed — dpkit reports them rather than fake-clean.
 */
export function collectFiles(datapack: string, only: string, overlayDirs: string[] = [], onUnreadable?: (entry: UnreadableDir) => void): { files: string[]; rels: string[] } {
  const out: Array<{ file: string; rel: string }> = [];
  const seen = new Set<string>();

  const walk = (dir: string, rootDataDir: string, makeRel: (rel: string) => string): void => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch (err) {
      // A missing data/ dir is normal for a data-less pack; anything else (permissions, I/O,
      // ENOTDIR from a data file masquerading as a directory) is an honest coverage gap.
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        onUnreadable?.({ path: dir, rel: makeRel(toRel(dir, rootDataDir)), error: (err as Error).message });
      }
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith('.')) continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) { walk(p, rootDataDir, makeRel); continue; }
      if (!CHECKABLE(e.name)) continue;
      const rel = makeRel(toRel(p, rootDataDir));
      if (seen.has(p)) continue;
      seen.add(p);
      out.push({ file: p, rel });
    }
  };

  walk(join(datapack, 'data'), join(datapack, 'data'), rel => rel);
  for (const dir of overlayDirs) {
    walk(join(datapack, dir, 'data'), join(datapack, dir, 'data'), rel => `${OVERLAY_REL_PREFIX}${dir}/${rel}`);
  }

  let items = out;
  if (only) items = out.filter(x => matchesOnly(dataRelOf(x.rel), only));
  items.sort((a, b) => a.rel.localeCompare(b.rel));
  return { files: items.map(x => x.file), rels: items.map(x => x.rel) };
}


/** Test a data/-relative rel (or a root file like pack.mcmeta) against a --files glob. */
export function matchesOnly(rel: string, only: string): boolean {
  if (!only) return true;
  let escaped = '';
  for (const ch of only) {
    if ('.[](){}?+^$|'.includes(ch) || ch === String.fromCharCode(92)) escaped += String.fromCharCode(92);
    escaped += ch;
  }
  const re = new RegExp('^' + escaped.replaceAll('*', '.*') + '$');
  return re.test(rel);
}
