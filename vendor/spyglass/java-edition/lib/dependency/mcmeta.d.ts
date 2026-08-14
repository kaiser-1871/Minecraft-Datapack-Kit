import * as core from '@spyglassmc/core';
import type { PackInfo, VersionInfo } from './common.js';
import { ReleaseVersion } from './common.js';
import type { McmetaStates, McmetaSummary, McmetaVersions } from './mcmeta/types.js';
/**
 * Determines the latest development release for which a release target could be determined
 * @param versions List of all versions in mcmeta
 * @returns latest development release
 */
export declare function getLatestSnapshot(versions: McmetaVersions): VersionInfo;
/**
 * @param inputVersion {@link core.Config.env.gameVersion}
 */
export declare function resolveConfiguredVersion(inputVersion: string, versions: McmetaVersions, packs: PackInfo[], logger: core.Logger): VersionInfo;
export declare function symbolRegistrar(summary: McmetaSummary, release: ReleaseVersion): core.SymbolRegistrar;
export declare const Fluids: McmetaStates;
//# sourceMappingURL=mcmeta.d.ts.map