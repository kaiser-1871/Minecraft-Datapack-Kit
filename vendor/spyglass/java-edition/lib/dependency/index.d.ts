export * from './common.js';
export * from './mcmeta.js';
export * from './mcmeta/index.js';
import * as core from '@spyglassmc/core';
import type { McmetaSummary } from './mcmeta/index.js';
interface GetMcmetaSummaryResult extends Partial<McmetaSummary> {
    checksum: string | undefined;
}
/**
 * Get vanilla resources, including block definitions, fluid definitions, command tree, and registries.
 *
 * @throws Network/file system errors.
 */
export declare function getMcmetaSummary(externals: core.Externals, logger: core.Logger, version: string, overridePaths?: core.EnvConfig['mcmetaSummaryOverrides']): Promise<GetMcmetaSummaryResult>;
/**
 * @throws Network/file system errors.
 */
export declare function getVanillaDatapack(externals: core.Externals, logger: core.Logger, version: string): Promise<core.Dependency>;
/**
 * @throws Network/file system errors.
 */
export declare function getVanillaResourcepack(externals: core.Externals, logger: core.Logger, version: string): Promise<core.Dependency>;
/**
 * @throws Network/file system errors.
 */
export declare function getVanillaMcdoc(externals: core.Externals, logger: core.Logger): Promise<core.Dependency>;
//# sourceMappingURL=index.d.ts.map