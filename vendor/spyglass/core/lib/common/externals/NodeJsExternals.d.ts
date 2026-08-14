import type fs from 'node:fs';
import fsp from 'node:fs/promises';
import { type DecompressedFile, type RootUriString } from '../../index.js';
import { Logger } from '../Logger.js';
import type { FsLocation } from './index.js';
export declare function getNodeJsExternals({ cacheRoot, logger, nodeFsp }?: {
    cacheRoot?: RootUriString;
    logger?: Logger;
    nodeFsp?: typeof fsp;
}): Readonly<{
    archive: {
        decompressBall(buffer: Uint8Array<ArrayBuffer>, options: {
            stripLevel?: number;
        } | undefined): Promise<DecompressedFile[]>;
    };
    error: {
        createKind(kind: import("./index.js").ExternalErrorKind, message: string): Error;
        isKind(e: unknown, kind: import("./index.js").ExternalErrorKind): boolean;
    };
    fs: {
        chmod(location: FsLocation, mode: number): Promise<void>;
        mkdir(location: FsLocation, options: {
            mode?: number;
            recursive?: boolean;
        } | undefined): Promise<undefined>;
        readdir(location: FsLocation): Promise<fs.Dirent<string>[]>;
        readFile(location: FsLocation): Promise<NonSharedBuffer>;
        rm(location: FsLocation, options: {
            recursive?: boolean;
        } | undefined): Promise<void>;
        showFile(location: FsLocation): Promise<void>;
        stat(location: FsLocation): Promise<fs.Stats>;
        unlink(location: FsLocation): Promise<void>;
        writeFile(location: FsLocation, data: string | Uint8Array<ArrayBuffer>, options: {
            mode: number;
        } | undefined): Promise<void>;
    };
    web: {
        getCache: () => Promise<HttpCache>;
    };
}>;
export declare const NodeJsExternals: Readonly<{
    archive: {
        decompressBall(buffer: Uint8Array<ArrayBuffer>, options: {
            stripLevel?: number;
        } | undefined): Promise<DecompressedFile[]>;
    };
    error: {
        createKind(kind: import("./index.js").ExternalErrorKind, message: string): Error;
        isKind(e: unknown, kind: import("./index.js").ExternalErrorKind): boolean;
    };
    fs: {
        chmod(location: FsLocation, mode: number): Promise<void>;
        mkdir(location: FsLocation, options: {
            mode?: number;
            recursive?: boolean;
        } | undefined): Promise<undefined>;
        readdir(location: FsLocation): Promise<fs.Dirent<string>[]>;
        readFile(location: FsLocation): Promise<NonSharedBuffer>;
        rm(location: FsLocation, options: {
            recursive?: boolean;
        } | undefined): Promise<void>;
        showFile(location: FsLocation): Promise<void>;
        stat(location: FsLocation): Promise<fs.Stats>;
        unlink(location: FsLocation): Promise<void>;
        writeFile(location: FsLocation, data: string | Uint8Array<ArrayBuffer>, options: {
            mode: number;
        } | undefined): Promise<void>;
    };
    web: {
        getCache: () => Promise<HttpCache>;
    };
}>;
/**
 * A non-spec-compliant, non-complete implementation of the Cache Web API for use in Spyglass.
 * This class stores the cached response on the file system under the cache root.
 */
declare class HttpCache implements Cache {
    #private;
    constructor(cacheRoot: RootUriString | undefined, logger: Logger, nodeFsp: typeof fsp);
    match(request: RequestInfo | URL, _options?: CacheQueryOptions | undefined): Promise<Response | undefined>;
    put(request: RequestInfo | URL, response: Response): Promise<void>;
    add(): Promise<void>;
    addAll(): Promise<void>;
    delete(): Promise<boolean>;
    keys(): Promise<readonly Request[]>;
    matchAll(): Promise<readonly Response[]>;
}
export {};
//# sourceMappingURL=NodeJsExternals.d.ts.map