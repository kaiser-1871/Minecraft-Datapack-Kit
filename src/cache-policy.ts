// cache-policy.ts — what to do when a requested version's per-version command data is not in
// the local Spyglass cache. Policy:
//   download (default) — try an on-demand download; if that fails, fail with exit code 2.
//   fallback           — try the download, then check with the nearest cached version and
//                        annotate the report header loudly.
//   fail               — do not download; fail immediately with the stable environment code 2.
import { cachedCommandVersions, loadCachedVersions, resolveConcreteVersion, CommandDataNotCachedError } from './syntax.js';
import { ENGINE_DATA_KINDS, ensureVersionData } from './version-data.js';
import type { VersionDataKind } from './version-data.js';
import { readCachedBytes } from './cache.js';

export type CacheMissPolicy = 'download' | 'fallback' | 'fail';

export interface VersionPlan {
  /** Raw CLI/config version (kept in report.version for CLI compatibility). */
  requested: string;
  /** Concrete version id to hand to the engine. */
  engineVersion: string;
  /** Concrete version requested (before any fallback). */
  targetVersion: string;
  /** The version that will actually be checked (== targetVersion unless fallback). */
  actualVersion: string;
  cacheSource: 'local cache' | 'downloaded this run' | 'fallback (nearest cached version)';
  fallback: boolean;
  targetDpv: number | null;
  actualDpv: number | null;
  message: string | null;
}

interface VersionEntry { id?: string; type?: string; data_version?: number; data_pack_version?: number }

function versionEntries(): VersionEntry[] {
  const list = loadCachedVersions();
  return Array.isArray(list) ? list as VersionEntry[] : [];
}

function entryOf(id: string): VersionEntry | undefined {
  return versionEntries().find(v => v.id === id);
}

function dpvOf(id: string): number | null {
  return entryOf(id)?.data_pack_version ?? null;
}

/** Nearest cached version to `target`, preferring releases and the closest data-pack version. */
export function nearestCachedVersion(target: string): { id: string; dpv: number | null } | null {
  const cached = cachedCommandVersions();
  const entries = versionEntries().filter(v => typeof v.id === 'string' && cached.has(v.id as string));
  if (!entries.length) return null;
  const targetDpv = dpvOf(target);
  const releases = entries.filter(v => v.type === 'release');
  const pool = releases.length ? releases : entries;
  pool.sort((a, b) => {
    const ad = a.data_pack_version ?? Number.MAX_SAFE_INTEGER;
    const bd = b.data_pack_version ?? Number.MAX_SAFE_INTEGER;
    if (targetDpv != null) {
      const diff = Math.abs(ad - targetDpv) - Math.abs(bd - targetDpv);
      if (diff !== 0) return diff;
    }
    return (b.data_version ?? 0) - (a.data_version ?? 0);
  });
  const pick = pool[0];
  return pick?.id ? { id: pick.id, dpv: pick.data_pack_version ?? null } : null;
}

function isAlias(v: string): boolean {
  return ['auto', 'latest release', 'latest snapshot'].includes(v);
}

function uncachedError(target: string, detail: string): Error {
  return new Error(
    `[check] version ${target} is not cached locally and command data could not be obtained (${detail}).\n` +
    `[check] options:\n` +
    `  1. retry the download:        node dpkit.mjs --version=${target} --cache-miss=download\n` +
    `  2. fall back to nearest cache: node dpkit.mjs --version=${target} --cache-miss=fallback\n` +
    `  3. fail without downloading:   node dpkit.mjs --version=${target} --cache-miss=fail`,
  );
}

/** The earliest version dpkit can ever check is the oldest entry in the data provider's
 * version list. That list currently starts at 1.14 (data-pack version 4); 1.13 has no
 * command-tree/registry data upstream, so "universal from 1.13" is impossible with this
 * data source and must fail loudly instead of checking the wrong grammar. */
function pre114Error(target: string): string | null {
  const m = /^1\.(\d+)(?:\.\d+)?$/.exec(target);
  if (!m || Number(m[1]) >= 14) return null;
  return `[check] dpkit has no version data before 1.14 (the upstream command data starts at 1.14, data-pack version 4); version ${target} cannot be checked with 1.13-era grammar.`;
}

/** Missing per-version engine dependencies, derived from the same URL layout the engine uses. */
function missingEngineData(target: string): VersionDataKind[] {
  const base = `https://api.spyglassmc.com/mcje/versions/${target}`;
  return ENGINE_DATA_KINDS.filter(k => readCachedBytes(`${base}/${k}`) == null);
}

/** Plan a concrete version id (local cache / download / fallback). */
export async function planConcreteVersion(
  target: string,
  policy: CacheMissPolicy,
  requestedLabel = target,
): Promise<VersionPlan> {
  const pre114 = pre114Error(target);
  if (pre114) throw new Error(pre114);
  const targetDpv = dpvOf(target);
  if (cachedCommandVersions().has(target)) {
    // Commands/registries may be cached while old-version engine dependencies are not. The
    // engine's own fetch timeout is too short for slow 1.14/1.15-era endpoints, so pre-warm
    // the missing pieces before starting the engine.
    if (policy === 'download') {
      const missing = missingEngineData(target);
      if (missing.length) await ensureVersionData(target, missing);
    }
    return {
      requested: requestedLabel,
      engineVersion: target,
      targetVersion: target,
      actualVersion: target,
      cacheSource: 'local cache',
      fallback: false,
      targetDpv,
      actualDpv: targetDpv,
      message: null,
    };
  }

  if (policy === 'fail') {
    throw new Error(
      `[check] version ${target} is not cached locally and --cache-miss=fail was selected.\n` +
      `[check] run online: node dpkit.mjs --version=${target} --cache-miss=download  (or use --cache-miss=fallback to check with the nearest cached version)`,
    );
  }

  try {
    await ensureVersionData(target, ENGINE_DATA_KINDS);
    return {
      requested: requestedLabel,
      engineVersion: target,
      targetVersion: target,
      actualVersion: target,
      cacheSource: 'downloaded this run',
      fallback: false,
      targetDpv,
      actualDpv: targetDpv,
      message: `downloaded command/registry data for ${target} this run`,
    };
  } catch (err) {
    const detail = err instanceof CommandDataNotCachedError || err instanceof Error ? err.message : String(err);
    if (policy !== 'fallback') {
      throw uncachedError(target, detail);
    }
    const nearest = nearestCachedVersion(target);
    if (!nearest) {
      throw new Error(
        `[check] version ${target} is not cached locally, the download failed (${detail}), and no other cached version exists to fall back to.\n` +
        `[check] run node dpkit.mjs --version=${target} online once to download it.`,
      );
    }
    return {
      requested: requestedLabel,
      engineVersion: nearest.id,
      targetVersion: target,
      actualVersion: nearest.id,
      cacheSource: 'fallback (nearest cached version)',
      fallback: true,
      targetDpv,
      actualDpv: nearest.dpv,
      message: `version ${target} is not cached; checking with nearest cached ${nearest.id} instead — results outside ${nearest.id} are NOT covered`,
    };
  }
}

/**
 * Plan a check for the raw CLI version. Returns null for 'auto' (the engine resolves it from
 * pack.mcmeta and no explicit version was requested).
 */
export async function planVersionCheck(requested: string, policy: CacheMissPolicy): Promise<VersionPlan | null> {
  if (requested === 'auto') return null;
  let target: string;
  try {
    target = resolveConcreteVersion(requested);
  } catch {
    if (policy === 'fail') {
      throw new Error(`[check] cannot resolve version '${requested}' from the local cache and --cache-miss=fail was selected. Run --versions online once, or choose --cache-miss=download.`);
    }
    try {
      target = await ensureVersionData(requested, ['commands', 'registries']);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw uncachedError(requested, detail);
    }
  }
  return planConcreteVersion(target, policy, requested);
}
