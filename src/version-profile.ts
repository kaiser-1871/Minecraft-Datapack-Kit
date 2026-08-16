// version-profile.ts — per-version data completeness / capability matrix.
//
// dpkit must never pretend a check is authoritative when the version data is incomplete.
// This module turns the local cache state + pack.mcmeta into a conservative profile:
//   full      — command tree and registry data are cached for the concrete version
//   partial   — some per-version data is cached (e.g. commands but not registries)
//   none      — no per-version data is cached
//   ambiguous — pack.mcmeta's format range does not uniquely identify one version
//
// `can_give_suggestions` is false unless the profile is `full` AND the version is not
// ambiguous, so the tool never emits "best practice" advice from incomplete data.

import { readCachedBytes } from './cache.js';
import { cachedCommandVersions, loadCachedVersions, resolveConcreteVersion } from './syntax.js';
import { loadRegistries } from './registry.js';
import { isUnboundedFormat } from './pack-mcmeta.js';

export type VersionProfile = 'full' | 'partial' | 'none' | 'ambiguous';

export interface VersionCapability {
  /** Effective concrete version the profile describes (may be null when nothing is cached). */
  version: string | null;
  profile: VersionProfile;
  /** True when the command tree is cached for the effective version. */
  hasCommands: boolean;
  /** True when any registry data is cached for the effective version. */
  hasRegistries: boolean;
  /** Count of registry names present in the cached registry data. */
  registryCount: number;
  /** Registry names that are known to exist in the version list but have no cached values. */
  unchecked_registry_ids: string[];
  /** Fraction [0,1] of expected registry entries present (null when no index available). */
  registry_coverage: number | null;
  can_give_suggestions: boolean;
}

function registryUrl(version: string): string {
  return `https://api.spyglassmc.com/mcje/versions/${version}/registries`;
}

/**
 * Compute the capability matrix for a version specifier.
 *
 * @param version raw version ('auto', 'latest release', or concrete like '26.2')
 * @param packMcmeta optional parsed pack.mcmeta info to detect ambiguity for auto versions
 */
export function versionCapability(
  version: string,
  packMcmeta?: { minFormat: number | null; maxFormat: number | null; packFormat: number | null } | null,
  concreteVersion?: string | null,
): VersionCapability {
  let concrete: string | null = concreteVersion ?? null;
  if (!concrete) {
    try {
      concrete = resolveConcreteVersion(version);
    } catch {
      // Not even the version list is cached → nothing can be judged.
      return {
        version: null,
        profile: 'none',
        hasCommands: false,
        hasRegistries: false,
        registryCount: 0,
        unchecked_registry_ids: [],
        registry_coverage: null,
        can_give_suggestions: false,
      };
    }
  }

  const hasCommands = cachedCommandVersions().has(concrete) || readCachedBytes(`https://api.spyglassmc.com/mcje/versions/${concrete}/commands`) != null;
  const regs = loadRegistries(concrete);
  const hasRegistries = Object.keys(regs).length > 0 || readCachedBytes(registryUrl(concrete)) != null;
  const registryCount = Object.keys(regs).length;

  let ambiguous = false;
  if (version === 'auto' && packMcmeta) {
    ambiguous = isAmbiguousPackFormat(packMcmeta.minFormat, packMcmeta.maxFormat, packMcmeta.packFormat);
  }

  let profile: VersionProfile = 'none';
  if (hasCommands && hasRegistries) profile = 'full';
  else if (hasCommands || hasRegistries) profile = 'partial';
  if (ambiguous) profile = 'ambiguous';

  // The Spyglass registries payload contains every registry name with its values, so when the
  // payload is cached the registry dimension is fully covered. If only the command tree is
  // cached, the registry dimension is not covered and we cannot enumerate unchecked IDs.
  const unchecked: string[] = [];
  const coverage: number | null = hasRegistries ? 1 : null;

  return {
    version: concrete,
    profile,
    hasCommands,
    hasRegistries,
    registryCount,
    unchecked_registry_ids: unchecked,
    registry_coverage: coverage,
    can_give_suggestions: profile === 'full' && !ambiguous,
  };
}

/** True when a pack-format range maps to more than one known release (or cannot be pinned). */
export function isAmbiguousPackFormat(
  minFormat: number | null,
  maxFormat: number | null,
  preferredPackFormat: number | null,
): boolean {
  const cached = loadCachedVersions();
  if (!Array.isArray(cached) || cached.length === 0) return true;
  const releases = (cached as Array<{ id?: string; type?: string; data_pack_version?: number; data_version?: number }>)
    .filter(v => v.type === 'release' && typeof v.id === 'string' && typeof v.data_pack_version === 'number')
    .sort((a, b) => (b.data_version ?? b.data_pack_version ?? 0) - (a.data_version ?? a.data_pack_version ?? 0));
  if (!releases.length) return true;

  const lo = minFormat ?? 0;
  const hi = maxFormat === null || isUnboundedFormat(maxFormat) ? Infinity : maxFormat;
  const inRange = releases.filter(v => (v.data_pack_version ?? 0) >= lo && (v.data_pack_version ?? 0) <= hi);

  // A base pack_format that exactly matches one release pins the version.
  if (preferredPackFormat != null) {
    const exact = releases.find(v => v.data_pack_version === preferredPackFormat);
    if (exact && (exact.data_pack_version ?? 0) >= lo && (exact.data_pack_version ?? 0) <= hi) return false;
  }

  // More than one release in range → not uniquely identifiable.
  return inRange.length > 1;
}

/** Convenience for callers that only need the profile label. */
export function versionProfileLabel(
  version: string,
  packMcmeta?: { minFormat: number | null; maxFormat: number | null; packFormat: number | null } | null,
): VersionProfile {
  return versionCapability(version, packMcmeta).profile;
}
