// pack-mcmeta.ts — deep pack.mcmeta validation (dpkit-side). The engine's pack_meta schema
// catches some type errors but is missing pack-format range checking and overlays, and the LSP
// path never publishes diagnostics for root-level files. dpkit therefore validates the metadata
// itself with the rules below and feeds overlay directories into file collection.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadCachedVersions } from './syntax.js';
import type { RawDiagnostic } from './types.js';

/** The conventional "no upper bound" sentinel used by vanilla/community packs. */
export const UNBOUNDED_FORMAT = 9999999;

export interface OverlayEntry {
  directory: string;
  minFormat: number | null;
  maxFormat: number | null;
}

export interface PackMcmetaScan {
  diagnostics: RawDiagnostic[];
  /** Valid overlay entries parsed from pack.mcmeta (used by file collection). */
  overlays: OverlayEntry[];
  /** Effective max data-pack format (max_format > supported_formats > pack_format). */
  maxFormat: number | null;
  /** Effective min data-pack format (supported_formats only). */
  minFormat: number | null;
  /** Declared base pack.pack_format (the primary dpv this pack was authored for). */
  packFormat: number | null;
  /** Human-readable summary of the declared range, e.g. "dpv 88..unbounded". */
  formatRangeLabel: string | null;
  /** Explicit note for the user when the target version is inside/outside the range. */
  formatHint: string | null;
  /** True when min_format/supported_formats/max_format (not just pack_format) were used. */
  hasExplicitRange: boolean;
}

interface ParsedFormats { min: number | null; max: number | null; diags: RawDiagnostic[] }

function diag(message: string, severity: 1 | 2 = 1): RawDiagnostic {
  return { severity, message, range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } } };
}

function isInt(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0;
}

/** True for the "unbounded" pack-format sentinel (9999999). */
export function isUnboundedFormat(n: number): boolean {
  return n >= UNBOUNDED_FORMAT;
}

/** Validate the pack-format-ish value in pack_format / max_format / overlay formats. */
function parseFormatField(raw: unknown, what: string): { value: number | null; diags: RawDiagnostic[] } {
  if (typeof raw === 'number') {
    if (!Number.isInteger(raw) || raw < 0) {
      return { value: null, diags: [diag(`pack.mcmeta ${what} must be a non-negative integer (got ${raw})`)] };
    }
    return { value: raw, diags: [] };
  }
  if (Array.isArray(raw)) {
    // max_format may be written as [major, minor]; Spyglass uses the first element.
    if (raw.length === 0 || !raw.every(n => isInt(n))) {
      return { value: null, diags: [diag(`pack.mcmeta ${what} array must contain only integers`)] };
    }
    return { value: raw[0] as number, diags: [] };
  }
  return { value: null, diags: [diag(`pack.mcmeta ${what} must be an integer or an integer array (got ${typeof raw})`)] };
}

/** Validate supported_formats ([min,max], {min_inclusive,max_inclusive}, or a single integer). */
function parseSupportedFormats(raw: unknown): ParsedFormats {
  // Known false positive: several real packs (and vanilla's own launcher flow) accept a single
  // integer as a shorthand for [n, n]. Spyglass's schema rejects it, Minecraft accepts it.
  if (typeof raw === 'number') {
    if (!isInt(raw)) {
      return { min: null, max: null, diags: [diag(`pack.mcmeta supported_formats must be an integer, [min, max], or {min_inclusive, max_inclusive} (got ${raw})`)] };
    }
    return { min: raw, max: raw, diags: [] };
  }
  if (Array.isArray(raw)) {
    if (raw.length !== 2 || !raw.every(n => isInt(n))) {
      return { min: null, max: null, diags: [diag('pack.mcmeta supported_formats must be [min, max] (two integers)')] };
    }
    const min = raw[0] as number, max = raw[1] as number;
    if (min > max) {
      return { min: null, max: null, diags: [diag(`pack.mcmeta supported_formats min (${min}) is greater than max (${max})`)] };
    }
    return { min, max, diags: [] };
  }
  if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    const min = obj.min_inclusive;
    const max = obj.max_inclusive;
    if (!isInt(min) || !isInt(max)) {
      return { min: null, max: null, diags: [diag('pack.mcmeta supported_formats object must have integer min_inclusive and max_inclusive')] };
    }
    if ((min as number) > (max as number)) {
      return { min: null, max: null, diags: [diag(`pack.mcmeta supported_formats min (${min}) is greater than max (${max})`)] };
    }
    return { min: min as number, max: max as number, diags: [] };
  }
  return { min: null, max: null, diags: [diag('pack.mcmeta supported_formats must be an array or an object')] };
}

/** Text components may be a string, an object, or an array — anything but scalar JSON. */
function isTextComponent(v: unknown): boolean {
  return typeof v === 'string' || (v !== null && typeof v === 'object');
}

function parseOverlays(raw: unknown): { entries: OverlayEntry[]; diags: RawDiagnostic[] } {
  if (raw === undefined) return { entries: [], diags: [] };
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { entries: [], diags: [diag('pack.mcmeta overlays must be an object with an entries array')] };
  }
  const entriesRaw = (raw as Record<string, unknown>).entries;
  if (!Array.isArray(entriesRaw)) {
    return { entries: [], diags: [diag('pack.mcmeta overlays.entries must be an array')] };
  }
  const entries: OverlayEntry[] = [];
  const diags: RawDiagnostic[] = [];
  for (let i = 0; i < entriesRaw.length; i++) {
    const e = entriesRaw[i] as Record<string, unknown> | null;
    const at = `pack.mcmeta overlays.entries[${i}]`;
    if (e === null || typeof e !== 'object' || Array.isArray(e)) {
      diags.push(diag(`${at} must be an object`));
      continue;
    }
    if (typeof e.directory !== 'string' || e.directory.length === 0 || e.directory.includes('..') || e.directory.startsWith('/') || e.directory.includes(String.fromCharCode(92))) {
      diags.push(diag(`${at}.directory must be a relative directory name (got ${JSON.stringify(e.directory)})`));
      continue;
    }
    if (e.formats === undefined) {
      diags.push(diag(`${at} is missing "formats" ([min, max], {min_inclusive,max_inclusive}, or a single integer)`));
      continue;
    }
    const f = parseSupportedFormats(e.formats);
    diags.push(...f.diags);
    entries.push({ directory: e.directory, minFormat: f.min, maxFormat: f.max });
  }
  return { entries, diags };
}

/** A "dpv 88..unbounded"-style label for the pack's declared format range. */
export function formatRangeLabel(min: number | null, max: number | null): string | null {
  if (min === null && max === null) return null;
  const lo = min ?? max ?? '?';
  const hi = max === null ? 'unbounded' : isUnboundedFormat(max) ? 'unbounded' : max;
  return `dpv ${lo}..${hi}`;
}

/**
 * Full pack.mcmeta validation. `root` enables overlay-directory existence checks and
 * `target` enables pack-format vs game-version compatibility checks.
 */
export function scanPackMcmeta(
  text: string,
  root?: string,
  target?: { version: string | null; dataPackVersion: number | null },
): PackMcmetaScan {
  const empty: PackMcmetaScan = { diagnostics: [], overlays: [], maxFormat: null, minFormat: null, packFormat: null, formatRangeLabel: null, formatHint: null, hasExplicitRange: false };
  let obj: unknown;
  try {
    obj = JSON.parse(text);
  } catch (err) {
    return { ...empty, diagnostics: [diag(`pack.mcmeta is not valid JSON: ${(err as Error).message}`)] };
  }
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return { ...empty, diagnostics: [diag('pack.mcmeta must be a JSON object')] };
  }
  const rootObj = obj as Record<string, unknown>;
  const pack = rootObj.pack;
  if (pack === null || typeof pack !== 'object' || Array.isArray(pack)) {
    return { ...empty, diagnostics: [diag('pack.mcmeta is missing a valid "pack" object (format: {"pack": {"pack_format": N, "description": "…"}})')] };
  }
  const p = pack as Record<string, unknown>;
  const diags: RawDiagnostic[] = [];

  if (p.overlays !== undefined) {
    diags.push(diag('pack.mcmeta overlays must be a top-level key, not a key inside "pack"'));
  }
  if (p.description === undefined) {
    diags.push(diag('pack.mcmeta pack.description is missing (a string or text-component object is required)'));
  } else if (!isTextComponent(p.description)) {
    diags.push(diag('pack.mcmeta pack.description must be a string, object, or array (JSON text component)'));
  }

  const minFormatField = p.min_format === undefined ? { value: null, diags: [] } : parseFormatField(p.min_format, 'pack.min_format');
  const maxFormatField = p.max_format === undefined ? { value: null, diags: [] } : parseFormatField(p.max_format, 'pack.max_format');
  const supported = p.supported_formats === undefined ? { min: null, max: null, diags: [] } : parseSupportedFormats(p.supported_formats);
  const packFormatField = p.pack_format === undefined ? { value: null, diags: [] } : parseFormatField(p.pack_format, 'pack.pack_format');
  diags.push(...minFormatField.diags, ...maxFormatField.diags, ...supported.diags, ...packFormatField.diags);

  const maxFormat = maxFormatField.value ?? supported.max ?? packFormatField.value;
  const minFormat = minFormatField.value ?? supported.min ?? packFormatField.value;
  const unboundedMax = maxFormat !== null && isUnboundedFormat(maxFormat);
  const hasExplicitRange = p.supported_formats !== undefined || p.max_format !== undefined || p.min_format !== undefined;
  if (maxFormat === null && minFormat === null) {
    diags.push(diag('pack.mcmeta has no usable pack format: provide pack.pack_format, pack.supported_formats, or pack.max_format'));
  }

  const rangeLabel = formatRangeLabel(minFormat, maxFormat);
  let formatHint: string | null = null;

  if (target?.dataPackVersion != null && maxFormat !== null) {
    const targetMax = target.dataPackVersion;
    const targetLabel = target.version ?? 'the target version';
    if (unboundedMax) {
      if (minFormat !== null && minFormat > targetMax) {
        diags.push(diag(
          `pack.mcmeta minimum supported format ${minFormat} is newer than ${targetLabel} (data pack version ${targetMax}) — the pack will not load`,
        ));
      } else {
        formatHint = `pack supports ${rangeLabel}; target ${targetLabel} (dpv ${targetMax}) is inside range.`;
      }
    } else if (minFormat !== null && minFormat > targetMax) {
      diags.push(diag(
        `pack.mcmeta minimum supported format ${minFormat} is newer than ${targetLabel} (data pack version ${targetMax}) — the pack will not load`,
      ));
    } else if (maxFormat < targetMax) {
      if (hasExplicitRange) {
        diags.push(diag(
          `pack.mcmeta supported format range ${rangeLabel} does not contain ${targetLabel} (data pack version ${targetMax}) — the pack will not load`,
        ));
      } else {
        diags.push(diag(
          `pack.mcmeta pack format ${maxFormat} predates ${targetLabel} (data pack version ${targetMax}) — the pack targets an older game version; pin --version= if that is intentional`,
          2,
        ));
      }
    } else if (minFormat === null && maxFormat > targetMax) {
      diags.push(diag(
        `pack.mcmeta pack format ${maxFormat} is newer than ${targetLabel} (data pack version ${targetMax}) — the pack will not load`,
      ));
    } else {
      if (hasExplicitRange) {
        formatHint = `pack supports ${rangeLabel}; target ${targetLabel} (dpv ${targetMax}) is inside range.`;
      }
    }
  }

  const overlays = parseOverlays(rootObj.overlays);
  diags.push(...overlays.diags);

  if (root) {
    for (const o of overlays.entries) {
      const dir = join(root, o.directory);
      if (!existsSync(dir)) {
        diags.push(diag(`pack.mcmeta overlay directory "${o.directory}" does not exist: ${dir}`, 2));
        continue;
      }
      if (!existsSync(join(dir, 'data'))) {
        diags.push(diag(`pack.mcmeta overlay directory "${o.directory}" has no data/ folder`, 2));
      }
    }
  }

  return { diagnostics: diags, overlays: overlays.entries, maxFormat, minFormat, packFormat: packFormatField.value, formatRangeLabel: rangeLabel, formatHint, hasExplicitRange };
}

/** Valid overlay directory names declared by a datapack's pack.mcmeta ([] when unreadable). */
export function overlayDirsOf(root: string): string[] {
  try {
    return scanPackMcmeta(readFileSync(join(root, 'pack.mcmeta'), 'utf8'), root).overlays.map(o => o.directory);
  } catch {
    return [];
  }
}

/**
 * True when an overlay entry is active for a target data-pack version. A null target version
 * (unknown before the engine resolves it) keeps the overlay active — dpkit is conservative and
 * reports coverage rather than silently dropping files it could not judge.
 */
export function isOverlayActive(entry: OverlayEntry, dataPackVersion: number | null): boolean {
  if (dataPackVersion === null) return true;
  // Malformed formats are diagnosed by scanPackMcmeta; keep the directory checked so the
  // format error is not compounded by silently dropping the overlay's files.
  if (entry.minFormat === null || entry.maxFormat === null) return true;
  const lo = entry.minFormat;
  const hi = isUnboundedFormat(entry.maxFormat) ? Infinity : entry.maxFormat;
  return dataPackVersion >= lo && dataPackVersion <= hi;
}

/** Overlay directories that apply to the target data-pack version (all of them when unknown). */
export function activeOverlayDirs(entries: OverlayEntry[], dataPackVersion: number | null): string[] {
  return entries.filter(e => isOverlayActive(e, dataPackVersion)).map(e => e.directory);
}

/** The data roots (root data/ plus every existing overlay data/) for a datapack directory. */
export function listDataRoots(root: string): string[] {
  const out = [join(root, 'data')];
  for (const dir of overlayDirsOf(root)) {
    const data = join(root, dir, 'data');
    if (existsSync(data)) out.push(data);
  }
  return out;
}

/** Data roots that are actually active for a target data-pack version (overlays filtered). */
export function activeDataRoots(root: string, entries: OverlayEntry[], dataPackVersion: number | null): string[] {
  const out = [join(root, 'data')];
  for (const dir of activeOverlayDirs(entries, dataPackVersion)) {
    const data = join(root, dir, 'data');
    if (existsSync(data)) out.push(data);
  }
  return out;
}

interface VersionEntry { id?: string; type?: string; data_version?: number; data_pack_version?: number }

function releasesSorted(): VersionEntry[] {
  const cached = loadCachedVersions();
  if (!Array.isArray(cached) || cached.length === 0) return [];
  return (cached as VersionEntry[])
    .filter(v => v.type === 'release' && typeof v.id === 'string' && typeof v.data_pack_version === 'number')
    .sort((a, b) => (b.data_version ?? b.data_pack_version ?? 0) - (a.data_version ?? a.data_pack_version ?? 0));
}

/** Resolve a pack format to the game version the engine would pick (for data-less packs). */
export function resolveVersionForPackFormat(packFormat: number): string | null {
  if (isUnboundedFormat(packFormat)) return resolveVersionForFormatRange(null, packFormat);
  const cached = loadCachedVersions();
  const releases = releasesSorted();
  const latestSnapshot = Array.isArray(cached) ? (cached as VersionEntry[]).find(v => v.type === 'snapshot') : undefined;
  let next: string | null = latestSnapshot?.id ?? releases[0]?.id ?? null;
  for (const v of releases) {
    const dpv = v.data_pack_version ?? 0;
    if (packFormat > dpv) return next;
    if (packFormat === dpv) return v.id ?? null;
    next = v.id ?? null;
  }
  return next;
}

/**
 * Pick the newest release whose data-pack version lies inside [min, max]. A null/9999999 max
 * means unbounded. When no release is inside the range, pick the release that makes the
 * range error clearest (latest when the range is too new, oldest when it is too old).
 */
export function resolveVersionForFormatRange(min: number | null, max: number | null, preferredPackFormat?: number | null): string | null {
  const releases = releasesSorted();
  if (!releases.length) return null;
  const lo = min ?? 0;
  const unbounded = max === null || isUnboundedFormat(max);
  const hi = unbounded ? Infinity : max as number;
  // A pack with min_format/max_format often still declares the version it was authored for
  // in pack.pack_format. Prefer the release that matches that dpv when it is inside the
  // declared range; otherwise fall back to the newest in-range release (the old behavior).
  if (preferredPackFormat != null && Number.isInteger(preferredPackFormat)) {
    const preferred = releases.find(v => v.data_pack_version === preferredPackFormat);
    if (preferred && preferredPackFormat >= lo && preferredPackFormat <= hi) return preferred.id ?? null;
  }
  const inside = releases.filter(v => (v.data_pack_version ?? 0) >= lo && (v.data_pack_version ?? 0) <= hi);
  if (inside.length) return inside[0].id ?? null;
  const newestDpv = releases[0].data_pack_version ?? 0;
  if (lo > newestDpv) return releases[0].id ?? null;
  return releases[releases.length - 1].id ?? null;
}

/** The data_pack_version for a concrete version id, or null when unknown. */
export function dataPackVersionOf(version: string): number | null {
  const cached = loadCachedVersions();
  if (!Array.isArray(cached)) return null;
  const entry = (cached as VersionEntry[]).find(v => v.id === version);
  return entry?.data_pack_version ?? null;
}
