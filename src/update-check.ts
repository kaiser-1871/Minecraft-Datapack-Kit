// update-check.ts — freshness check for the vendored Spyglass engine.
//
// dpkit's engine is vendored (vendor/spyglass/BUILD.json records when it was built and the
// GitHub main HEAD as of that moment). This module compares that record against the live
// SpyglassMC/Spyglass main branch and reports whether the upstream has moved — i.e. whether
// `npm run vendor` would pull in a newer engine. Purely informational; offline degrades to
// "unknown" instead of failing.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT_DIR } from './paths.js';

export interface EngineBuildInfo {
  /** ISO timestamp the vendored engine was built at (null when BUILD.json is absent). */
  builtAt: string | null;
  /** main-branch commit recorded at vendor time. */
  recorded: { sha: string; date: string | null } | null;
  /** Whether the source checkout byte-matched GitHub main HEAD at vendor time (probe file). */
  sourceMatchesMainHead: boolean | null;
}

export interface EngineUpdateInfo extends EngineBuildInfo {
  /** Live GitHub main HEAD (null when the fetch failed / offline). */
  latest: { sha: string; date: string | null; message: string | null } | null;
  /** true = main moved past the recorded commit; false = unchanged; null = unknown. */
  newer: boolean | null;
  offline: boolean;
}

/** Read vendor/spyglass/BUILD.json (best-effort; nulls when absent/malformed). */
export function loadEngineBuildInfo(): EngineBuildInfo {
  try {
    const meta = JSON.parse(readFileSync(join(ROOT_DIR, 'vendor', 'spyglass', 'BUILD.json'), 'utf8')) as {
      builtAt?: unknown;
      sourceMatchesMainHead?: unknown;
      spyglassMainAtVendor?: { sha?: unknown; date?: unknown } | null;
    };
    const recorded = meta.spyglassMainAtVendor && typeof meta.spyglassMainAtVendor.sha === 'string'
      ? {
        sha: meta.spyglassMainAtVendor.sha,
        date: typeof meta.spyglassMainAtVendor.date === 'string' ? meta.spyglassMainAtVendor.date : null,
      }
      : null;
    return {
      builtAt: typeof meta.builtAt === 'string' ? meta.builtAt : null,
      recorded,
      sourceMatchesMainHead: typeof meta.sourceMatchesMainHead === 'boolean' ? meta.sourceMatchesMainHead : null,
    };
  } catch {
    return { builtAt: null, recorded: null, sourceMatchesMainHead: null };
  }
}

/** Compare the vendored build record against the live Spyglass main branch. */
export async function checkEngineUpdates(timeoutMs = 8000): Promise<EngineUpdateInfo> {
  const local = loadEngineBuildInfo();
  try {
    const res = await fetch('https://api.github.com/repos/SpyglassMC/Spyglass/commits/main', {
      headers: { 'User-Agent': 'dpkit-update-check' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return { ...local, latest: null, newer: null, offline: true };
    const j = await res.json() as {
      sha?: unknown;
      commit?: { committer?: { date?: unknown } | null; message?: unknown } | null;
    };
    const sha = typeof j.sha === 'string' ? j.sha : '';
    const date = typeof j.commit?.committer?.date === 'string' ? j.commit.committer.date : null;
    const message = typeof j.commit?.message === 'string' ? j.commit.message.split(String.fromCharCode(10))[0] : null;
    let newer: boolean | null = null;
    if (local.recorded && sha) newer = sha !== local.recorded.sha;
    return { ...local, latest: sha ? { sha, date, message } : null, newer, offline: false };
  } catch {
    return { ...local, latest: null, newer: null, offline: true };
  }
}
