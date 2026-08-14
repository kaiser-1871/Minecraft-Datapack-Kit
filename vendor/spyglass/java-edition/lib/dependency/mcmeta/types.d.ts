export interface McmetaVersion {
    id: string;
    name: string;
    type: 'release' | 'snapshot';
    stable: boolean;
    data_version: number;
    protocol_version: number;
    data_pack_version: number;
    data_pack_version_minor: number;
    resource_pack_version: number;
    resource_pack_version_minor: number;
    build_time: string;
    release_time: string;
    sha1: string;
}
export declare namespace McmetaVersion {
    function check(val: unknown): string | undefined;
    function assert(val: unknown): asserts val is McmetaVersion;
    function is(val: unknown): val is McmetaVersion;
}
export type McmetaVersions = [McmetaVersion, ...McmetaVersion[]];
export declare namespace McmetaVersions {
    function check(val: unknown): string | undefined;
    function assert(val: unknown): asserts val is McmetaVersions;
    function is(val: unknown): val is McmetaVersions;
}
/**
 * https://minecraft.wiki/w/Version_manifest.json
 */
export interface MojangVersionManifestEntry {
    id: string;
    type: string;
    /**
     * URL to download a `MojangClientJson`
     */
    url: string;
    time: string;
    releaseTime: string;
    sha1: string;
}
export declare namespace MojangVersionManifestEntry {
    function check(val: unknown): string | undefined;
    function assert(val: unknown): asserts val is MojangVersionManifestEntry;
    function is(val: unknown): val is MojangVersionManifestEntry;
}
/**
 * https://minecraft.wiki/w/Version_manifest.json
 */
export interface MojangVersionManifest {
    versions: MojangVersionManifestEntry[];
}
export declare namespace MojangVersionManifest {
    function check(val: unknown): string | undefined;
    function assert(val: unknown): asserts val is MojangVersionManifest;
    function is(val: unknown): val is MojangVersionManifest;
}
/**
 * https://minecraft.wiki/w/Client.json
 */
export interface MojangClientJson {
    downloads: {
        client: {
            /**
             * URL to download a client Jar, whicn includes a `MojangVersionJson`
             */
            url: string;
        };
    };
}
export declare namespace MojangClientJson {
    function check(val: unknown): string | undefined;
    function assert(val: unknown): asserts val is MojangClientJson;
    function is(val: unknown): val is MojangClientJson;
}
/**
 * https://minecraft.wiki/w/Version.json
 */
export interface MojangVersionJson {
    name: string;
    pack_version: {
        resource_major: number;
        resource_minor: number;
        data_major: number;
        data_minor: number;
    };
    protocol_version: number;
    stable: boolean;
    world_version: number;
    build_time: string;
}
export declare namespace MojangVersionJson {
    function check(val: unknown): string | undefined;
    function assert(val: unknown): asserts val is MojangVersionJson;
    function is(val: unknown): val is MojangVersionJson;
}
export interface McmetaSummary {
    blocks: McmetaStates;
    commands: McmetaCommands;
    fluids: McmetaStates;
    registries: McmetaRegistries;
}
export interface McmetaStates {
    [id: string]: [{
        [name: string]: string[];
    }, {
        [name: string]: string;
    }];
}
export type McmetaCommands = RootTreeNode;
interface BaseTreeNode {
    type: string;
    children?: {
        [name: string]: CommandTreeNode;
    };
    executable?: boolean;
    redirect?: [string];
}
export interface ArgumentTreeNode extends BaseTreeNode {
    type: 'argument';
    parser: string;
    properties?: {
        [name: string]: any;
    };
}
export interface LiteralTreeNode extends BaseTreeNode {
    type: 'literal';
}
export interface RootTreeNode extends BaseTreeNode {
    type: 'root';
    children: {
        [command: string]: LiteralTreeNode;
    };
}
export type CommandTreeNode = ArgumentTreeNode | LiteralTreeNode | RootTreeNode;
export interface McmetaRegistries {
    [id: string]: string[];
}
export {};
//# sourceMappingURL=types.d.ts.map