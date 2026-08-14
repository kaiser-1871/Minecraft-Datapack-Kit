import { bigintJsonNumberReplacer, bigintJsonNumberReviver, bufferToString, compressBytes, decompressBytes, Uri, } from '../common/index.js';
export var fileUtil;
(function (fileUtil) {
    /**
     * Get the relative URI of `target` based from `base`.
     *
     * @returns The relative URI, or `undefined` if `target` is not under `base`.
     */
    function getRelativeUriFromBase(target, base) {
        const baseUri = new Uri(base);
        const targetUri = new Uri(target);
        if (baseUri.origin !== targetUri.origin) {
            // Different scheme, hostname, and/or port
            return undefined;
        }
        const baseComponents = baseUri.pathname.split('/').filter((v) => !!v).map(decodeURIComponent);
        const targetComponents = targetUri.pathname.split('/').filter((v) => !!v).map(decodeURIComponent);
        if (baseComponents.length > targetComponents.length
            || baseComponents.some((bc, i) => bc !== targetComponents[i])) {
            return undefined;
        }
        return targetComponents.slice(baseComponents.length).map(encodeURIComponent).join('/');
    }
    fileUtil.getRelativeUriFromBase = getRelativeUriFromBase;
    function isSubUriOf(uri, base) {
        return getRelativeUriFromBase(uri, base) !== undefined;
    }
    fileUtil.isSubUriOf = isSubUriOf;
    /**
     * @param rootUris The root URIs. Each URI in this array must end with a slash (`/`).
     * @param uri The target file URI.
     * @returns The relative path from one of the `roots` to the `uri`, or `undefined` if the `uri` is not under any roots.
     * The separation used in the relative path is always slash (`/`).
     * @example
     * getRels(['file:///root/foo/', 'file:///root/'], 'file:///root/foo/bar/qux.json')
     * // -> 'bar/qux.json'
     * // -> 'foo/bar/qux.json'
     * // -> undefined
     *
     * getRels(['file:///root/foo/', 'file:///root/'], 'file:///outsider.json')
     * // -> undefined
     */
    function* getRels(uri, rootUris) {
        for (const root of rootUris) {
            const rel = getRelativeUriFromBase(uri, root);
            if (rel !== undefined) {
                yield rel;
            }
        }
        return undefined;
    }
    fileUtil.getRels = getRels;
    /**
     * @see {@link getRels}
     * @example
     * getRel(['file:///root/foo/', 'file:///root/'], 'file:///root/foo/bar/qux.json') // -> 'bar/qux.json'
     * getRel(['file:///root/foo/', 'file:///root/'], 'file:///outsider.json') // -> undefined
     */
    function getRel(uri, rootUris) {
        return getRels(uri, rootUris).next().value;
    }
    fileUtil.getRel = getRel;
    function* getRoots(uri, rootUris) {
        for (const root of rootUris) {
            const rel = getRelativeUriFromBase(uri, root);
            if (rel !== undefined) {
                yield root;
            }
        }
        return undefined;
    }
    fileUtil.getRoots = getRoots;
    function getRoot(uri, rootUris) {
        return getRoots(uri, rootUris).next().value;
    }
    fileUtil.getRoot = getRoot;
    function isRootUri(uri) {
        return uri.endsWith('/');
    }
    fileUtil.isRootUri = isRootUri;
    function ensureEndingSlash(uri) {
        return isRootUri(uri) ? uri : `${uri}/`;
    }
    fileUtil.ensureEndingSlash = ensureEndingSlash;
    function trimEndingSlash(uri) {
        return isRootUri(uri) ? uri.slice(0, -1) : uri;
    }
    fileUtil.trimEndingSlash = trimEndingSlash;
    /**
     * @param encodedPath A properly encoded URI path with potentially many segments.
     */
    function joinEncodedPath(baseUri, encodedPath) {
        return (ensureEndingSlash(baseUri)
            + (encodedPath.startsWith('/') ? encodedPath.slice(1) : encodedPath));
    }
    fileUtil.joinEncodedPath = joinEncodedPath;
    /**
     * @param rawSegment A single unencoded URI path segment. Will be percent-encoded and appended to the base URI.
     */
    function joinRawSegment(baseUri, rawSegment) {
        return joinEncodedPath(baseUri, encodeURIComponent(rawSegment));
    }
    fileUtil.joinRawSegment = joinRawSegment;
    function isFileUri(uri) {
        return uri.startsWith('file:');
    }
    fileUtil.isFileUri = isFileUri;
    /**
     * @returns The part from the last `.` to the end of the URI, or `undefined` if no dots exist. No special treatment for leading dots.
     */
    function extname(value) {
        const i = value.lastIndexOf('.');
        return i >= 0 ? value.slice(i) : undefined;
    }
    fileUtil.extname = extname;
    /**
     * @returns The part from the last `/` to the end of the URI.
     */
    function basename(uri) {
        const i = uri.lastIndexOf('/');
        return i >= 0 ? uri.slice(i + 1) : uri;
    }
    fileUtil.basename = basename;
    /**
     * @returns The part from the beginning of the URI to the last `/`.
     */
    function dirname(uri) {
        const i = uri.lastIndexOf('/');
        return i >= 0 ? uri.slice(0, i) : uri;
    }
    fileUtil.dirname = dirname;
    /* istanbul ignore next */
    function getParentOfUri(uri) {
        return new Uri('.', trimEndingSlash(uri.toString()));
    }
    fileUtil.getParentOfUri = getParentOfUri;
    /* istanbul ignore next */
    /**
     * @throws
     *
     * @param mode Default to `0o777` (`rwxrwxrwx`)
     */
    async function ensureDir(externals, path, mode = 0o777) {
        try {
            await externals.fs.mkdir(path, { mode, recursive: true });
        }
        catch (e) {
            if (!externals.error.isKind(e, 'EEXIST')) {
                throw e;
            }
        }
    }
    fileUtil.ensureDir = ensureDir;
    /* istanbul ignore next */
    /**
     * @throws
     *
     * Ensures the parent directory of the path exists.
     *
     * @param mode Default to `0o777` (`rwxrwxrwx`)
     */
    async function ensureParentOfFile(externals, path, mode = 0o777) {
        return ensureDir(externals, getParentOfUri(path), mode);
    }
    fileUtil.ensureParentOfFile = ensureParentOfFile;
    async function chmod(externals, path, mode) {
        return externals.fs.chmod(path, mode);
    }
    fileUtil.chmod = chmod;
    async function ensureWritable(externals, path) {
        try {
            await chmod(externals, path, 0o666);
        }
        catch (e) {
            if (!externals.error.isKind(e, 'ENOENT')) {
                throw e;
            }
        }
    }
    fileUtil.ensureWritable = ensureWritable;
    /**
     * @returns An array of file URI strings.
     */
    async function getAllFiles(externals, root, depth = Number.POSITIVE_INFINITY) {
        async function walk(path, level) {
            if (level > depth) {
                return [];
            }
            const entries = await externals.fs.readdir(path);
            return (await Promise.all(entries.map(async (e) => {
                const entryPath = fileUtil.joinRawSegment(path.toString(), e.name);
                if (e.isDirectory()) {
                    return await walk(entryPath, level + 1);
                }
                else if (e.isFile()) {
                    return entryPath;
                }
                else {
                    return [];
                }
            }))).flat();
        }
        return walk(root, 0);
    }
    fileUtil.getAllFiles = getAllFiles;
    async function markReadOnly(externals, path) {
        return chmod(externals, path, 0o444);
    }
    fileUtil.markReadOnly = markReadOnly;
    async function unlink(externals, path) {
        return externals.fs.unlink(path);
    }
    fileUtil.unlink = unlink;
    async function readFile(externals, path) {
        return externals.fs.readFile(path);
    }
    fileUtil.readFile = readFile;
    /* istanbul ignore next */
    /**
     * @throws
     *
     * The directory of the file will be created recursively if it doesn't exist.
     *
     * The target file will be given permission `0o666` (`rw-rw-rw-`) before being written into, and changed back to the
     * specified `mode`.
     *
     * * Encoding: `utf-8`
     * * Mode: `0o666` (`rw-rw-rw-`)
     * * Flag: `w`
     */
    async function writeFile(externals, path, data, mode = 0o666) {
        await ensureParentOfFile(externals, path);
        await ensureWritable(externals, path);
        return externals.fs.writeFile(path, data, { mode });
    }
    fileUtil.writeFile = writeFile;
    /* istanbul ignore next */
    /**
     * @throws
     */
    async function readJson(externals, path) {
        return JSON.parse(bufferToString(await readFile(externals, path)), bigintJsonNumberReviver);
    }
    fileUtil.readJson = readJson;
    /* istanbul ignore next */
    /**
     * @throws
     *
     * @see {@link writeFile}
     */
    async function writeJson(externals, path, data) {
        return writeFile(externals, path, JSON.stringify(data, bigintJsonNumberReplacer));
    }
    fileUtil.writeJson = writeJson;
    /**
     * @throws
     */
    async function readGzippedFile(externals, path) {
        return decompressBytes(await readFile(externals, path), 'gzip');
    }
    fileUtil.readGzippedFile = readGzippedFile;
    /**
     * @throws
     */
    async function writeGzippedFile(externals, path, buffer) {
        if (typeof buffer === 'string') {
            buffer = new TextEncoder().encode(buffer);
        }
        return writeFile(externals, path, await compressBytes(buffer, 'gzip'));
    }
    fileUtil.writeGzippedFile = writeGzippedFile;
    /**
     * @throws
     */
    async function readGzippedJson(externals, path, reviver) {
        return JSON.parse(bufferToString(await readGzippedFile(externals, path)), reviver ?? bigintJsonNumberReviver);
    }
    fileUtil.readGzippedJson = readGzippedJson;
    /**
     * @throws
     */
    async function writeGzippedJson(externals, path, data, replacer) {
        return writeGzippedFile(externals, path, JSON.stringify(data, replacer ?? bigintJsonNumberReplacer));
    }
    fileUtil.writeGzippedJson = writeGzippedJson;
})(fileUtil || (fileUtil = {}));
//# sourceMappingURL=fileUtil.js.map