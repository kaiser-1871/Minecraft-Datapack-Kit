// delta.ts — baseline load/save and the stable per-file issue signature used by --delta.
import { readFileSync, writeFileSync } from 'node:fs';
import type { BaselineEntry, RawDiagnostic } from './types.js';

/**
 * Stable signature of a file's non-ignored issues, for --delta comparison.
 * Sorted by position then rendered as "severity:message" lines.
 */
export function issueSig(ds: ReadonlyArray<RawDiagnostic>): string {
  return [...ds]
    .sort((a, b) => (a.range.start.line - b.range.start.line) || (a.range.start.character - b.range.start.character))
    .map(d => `${d.severity}:${d.message}`).join('\n');
}

/** Load a baseline that matches the given datapack + version, else an empty record. */
export function loadBaseline(
  baselineFile: string,
  datapack: string,
  version: string,
): Record<string, BaselineEntry> {
  try {
    const b = JSON.parse(readFileSync(baselineFile, 'utf8')) as {
      datapack?: string;
      version?: string;
      files?: Record<string, BaselineEntry>;
    };
    if (b.datapack === datapack && b.version === version) return b.files ?? {};
  } catch { /* no usable baseline yet */ }
  return {};
}

export function saveBaseline(
  baselineFile: string,
  baseline: { datapack: string; version: string; files: Record<string, BaselineEntry> },
): void {
  writeFileSync(baselineFile, JSON.stringify(baseline, null, 2));
}
