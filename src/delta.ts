// delta.ts — baseline load/save and the stable per-file issue signature used by --delta.
//
// The baseline file holds MULTIPLE datapacks: one entry per "datapack@@version" key, so
// checking different packs doesn't clobber each other's history. Legacy single-entry
// files (top-level datapack/version/files) are still read and migrated on save.
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import type { BaselineEntry, RawDiagnostic } from './types.js';

/** Stable signature of a file's non-ignored issues, for --delta comparison. */
export function issueSig(ds: ReadonlyArray<RawDiagnostic>): string {
  return [...ds]
    .sort((a, b) => (a.range.start.line - b.range.start.line) || (a.range.start.character - b.range.start.character))
    .map(d => `${d.severity}:${d.message}`).join('\n');
}

const key = (datapack: string, version: string): string => `${datapack}@@${version}`;

interface BaselineStore {
  schema?: number;
  /** Human-readable format version of the baseline file (new in schema 2; old files load fine). */
  formatVersion?: number;
  baselines?: Record<string, { files?: Record<string, BaselineEntry> }>;
  // legacy single-entry shape
  datapack?: string;
  version?: string;
  files?: Record<string, BaselineEntry>;
}

/** Error/warning counts encoded in an issue signature (1 = error, 2 = warning). */
export function sigCounts(sig: string | undefined | null): { errors: number; warnings: number } {
  const out = { errors: 0, warnings: 0 };
  if (!sig) return out;
  for (const line of sig.split(String.fromCharCode(10))) {
    if (line.startsWith('1:')) out.errors++;
    else if (line.startsWith('2:')) out.warnings++;
  }
  return out;
}

/**
 * Load a baseline that matches the given datapack + version, else an empty record.
 * `fallbackVersion` is the raw requested version (e.g. 'auto') — used to migrate baselines
 * that were previously keyed on the raw specifier instead of the resolved concrete version.
 */
export function loadBaseline(
  baselineFile: string,
  datapack: string,
  version: string,
  fallbackVersion?: string,
): Record<string, BaselineEntry> {
  try {
    const b = JSON.parse(readFileSync(baselineFile, 'utf8')) as BaselineStore;
    const entry = b.baselines?.[key(datapack, version)];
    if (entry?.files) return entry.files;
    // legacy single-entry file written before multi-baseline support
    if (b.datapack === datapack && b.version === version && b.files) return b.files;
    // migration: an old baseline keyed on the raw specifier still applies
    if (fallbackVersion && fallbackVersion !== version) {
      const legacy = b.baselines?.[key(datapack, fallbackVersion)];
      if (legacy?.files) return legacy.files;
      if (b.datapack === datapack && b.version === fallbackVersion && b.files) return b.files;
    }
  } catch { /* no usable baseline yet */ }
  return {};
}

export function saveBaseline(
  baselineFile: string,
  baseline: { datapack: string; version: string; files: Record<string, BaselineEntry> },
): void {
  let store: BaselineStore = { schema: 2, formatVersion: 2 };
  try { store = JSON.parse(readFileSync(baselineFile, 'utf8')) as BaselineStore; } catch { /* start fresh */ }
  store.schema = 2;
  store.formatVersion = 2;
  store.baselines ??= {};
  store.baselines[key(baseline.datapack, baseline.version)] = { files: baseline.files };
  // migrate: drop legacy top-level fields now that we're in multi-entry form
  delete store.datapack;
  delete store.version;
  delete store.files;
  // Atomic write: write to a temp file then rename over the target, so an interrupted
  // write (Ctrl-C, crash) can't leave a half-written baseline that breaks the next --delta.
  const tmp = `${baselineFile}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(store, null, 2));
  renameSync(tmp, baselineFile);
}
