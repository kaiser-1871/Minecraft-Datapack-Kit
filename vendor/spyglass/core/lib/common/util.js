import externalBinarySearch from 'binary-search';
import rfdc from 'rfdc';
import { URL as WhatwgURL } from 'whatwg-url';
// We try to use the `URL` class built-in to the JavaScript runtime if possible, but falls back to
// use the `URL` class from the `whatwg-url` package if a certain bug exists.
// See more at https://github.com/SpyglassMC/Spyglass/issues/1763.
//
// The name "URI" instead of "URL" is used to align with LSP terminology.
export const Uri = isBuiltInURLGood() ? URL : WhatwgURL;
function isBuiltInURLGood() {
    try {
        return new URL('archive://mcdoc.tar.gz/foo.mcdoc').host === 'mcdoc.tar.gz';
    }
    catch {
        return false;
    }
}
/**
 * @param getKey A function that takes the actual arguments being passed into the decorated method, and returns anything.
 * The result of this function will be used as the key to identify the `Promise`. By default the first element in the argument
 * list will be used.
 *
 * This is a decorator for async methods. Decorated methods will return the same `Promise` for
 * the same key, provided that the previously returned `Promise` is still pending.
 */
export function SingletonPromise(getKey = (args) => args[0]) {
    return (_target, _key, descripter) => {
        const promises = new Map();
        const decoratedMethod = descripter.value;
        // The `function` syntax is used to preserve `this` context from the decorated method.
        descripter.value = function (...args) {
            const key = getKey(args);
            if (promises.has(key)) {
                return promises.get(key);
            }
            const ans = decoratedMethod.apply(this, args).then((ans) => (promises.delete(key), ans), (e) => (promises.delete(key), Promise.reject(e)));
            promises.set(key, ans);
            return ans;
        };
        return descripter;
    };
}
/**
 * This is a decorator for methods. Decorated methods will return the same non-`undefined` value no matter what.
 */
export const Singleton = (_target, _key, descripter) => {
    let value;
    const decoratedMethod = descripter.value;
    // The `function` syntax is used to preserve `this` context from the decorated method.
    descripter.value = function (...args) {
        return (value ??= decoratedMethod.apply(this, args));
    };
    return descripter;
};
/**
 * @param getKey A function that takes the actual arguments being passed into the decorated method, and returns anything.
 * The result of this function will be used as the key to cache the `Timeout`. By default the first element in the argument
 * list will be used.
 *
 * Decorated methods will be scheduled to run after `ms` milliseconds. The timer will reset when the method is called again.
 */
export function Delay(ms, getKey = (args) => args[0]) {
    return (_target, _key, descripter) => {
        const timeouts = new Map();
        const decoratedMethod = descripter.value;
        // The `function` syntax is used to preserve `this` context from the decorated method.
        descripter.value = function (...args) {
            const key = getKey(args);
            if (timeouts.has(key)) {
                clearTimeout(timeouts.get(key));
            }
            timeouts.set(key, setTimeout(() => {
                timeouts.delete(key);
                decoratedMethod.apply(this, args);
            }, ms));
        };
        return descripter;
    };
}
export var ResourceLocation;
(function (ResourceLocation) {
    /**
     * The prefix for tags.
     */
    ResourceLocation.TagPrefix = '#';
    /**
     * The seperator of namespace and path.
     */
    ResourceLocation.NamespacePathSep = ':';
    /**
     * The seperator between different path segments.
     */
    ResourceLocation.PathSep = '/';
    ResourceLocation.DefaultNamespace = 'minecraft';
    function lengthen(value) {
        switch (value.indexOf(ResourceLocation.NamespacePathSep)) {
            case -1:
                return `${ResourceLocation.DefaultNamespace}${ResourceLocation.NamespacePathSep}${value}`;
            case 0:
                return `${ResourceLocation.DefaultNamespace}${value}`;
            default:
                return value;
        }
    }
    ResourceLocation.lengthen = lengthen;
    function shorten(value) {
        return value.replace(/^(?:minecraft)?:/, '');
    }
    ResourceLocation.shorten = shorten;
})(ResourceLocation || (ResourceLocation = {}));
/**
 * @returns The string value decoded from the buffer according to UTF-8.
 * Byte order mark is correctly removed.
 */
export function bufferToString(buffer) {
    const ans = new TextDecoder().decode(buffer);
    // if (ans.charCodeAt(0) === 0xFEFF) {
    // 	return ans.slice(1)
    // }
    return ans;
}
export var Arrayable;
(function (Arrayable) {
    function is(value, isT) {
        return Array.isArray(value) ? value.every((e) => isT(e)) : isT(value);
    }
    Arrayable.is = is;
    function toArray(value) {
        return Array.isArray(value) ? value : [value];
    }
    Arrayable.toArray = toArray;
})(Arrayable || (Arrayable = {}));
export var TypePredicates;
(function (TypePredicates) {
    function isString(value) {
        return typeof value === 'string';
    }
    TypePredicates.isString = isString;
})(TypePredicates || (TypePredicates = {}));
export function promisifyAsyncIterable(iterable, joiner) {
    return (async () => {
        const chunks = [];
        for await (const chunk of iterable) {
            chunks.push(chunk);
        }
        return joiner(chunks);
    })();
}
export async function parseGzippedJson(bytes) {
    return JSON.parse(bufferToString(await decompressBytes(bytes, 'gzip')));
}
/**
 * @returns Is Plain Old JavaScript Object (POJO).
 */
export function isPojo(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}
export function merge(a, b) {
    const ans = rfdc()(a);
    for (const [key, value] of Object.entries(b)) {
        if (isPojo(ans[key]) && isPojo(value)) {
            ans[key] = merge(ans[key], value);
        }
        else if (value === undefined) {
            delete ans[key];
        }
        else {
            ans[key] = value;
        }
    }
    return ans;
}
export var Lazy;
(function (Lazy) {
    const LazyDiscriminator = Symbol('LazyDiscriminator');
    function create(getter) {
        return { discriminator: LazyDiscriminator, getter };
    }
    Lazy.create = create;
    function isComplex(lazy) {
        return lazy?.discriminator === LazyDiscriminator;
    }
    Lazy.isComplex = isComplex;
    function isUnresolved(lazy) {
        return isComplex(lazy) && !('value' in lazy);
    }
    Lazy.isUnresolved = isUnresolved;
    function resolve(lazy) {
        return isUnresolved(lazy) ? (lazy.value = lazy.getter()) : lazy;
    }
    Lazy.resolve = resolve;
})(Lazy || (Lazy = {}));
/**
 * @param ids An array of block/fluid IDs, with or without the namespace.
 * @returns A map from state names to the corresponding sets of values. The first element in the value array is the default
 * value for that state.
 */
export function getStates(category, ids, ctx) {
    const ans = {};
    ids = ids.map(ResourceLocation.lengthen);
    for (const id of ids) {
        ctx.symbols.query(ctx.doc, category, id).forEachMember((state, stateQuery) => {
            const values = Object.keys(stateQuery.visibleMembers);
            const set = (ans[state] ??= new Set());
            const defaultValue = stateQuery.symbol?.relations?.['default'];
            if (defaultValue) {
                set.add(defaultValue.path[defaultValue.path.length - 1]);
            }
            for (const value of values) {
                set.add(value);
            }
        });
    }
    return Object.fromEntries(Object.entries(ans).map(([k, v]) => [k, [...v]]));
}
export const binarySearch = externalBinarySearch;
export function isIterable(value) {
    return !!value[Symbol.iterator];
}
// #region ESNext functions polyfill
export function getOrInsert(map, key, defaultValue) {
    if (!map.has(key)) {
        map.set(key, defaultValue);
    }
    return map.get(key);
}
export function getOrInsertComputed(map, key, callbackFunction) {
    if (!map.has(key)) {
        map.set(key, callbackFunction(key));
    }
    return map.get(key);
}
/**
 * TODO: replace with ESNext Uint8Array.prototype.toHex once it's widely supported
 */
export function bytesToHex(bytes) {
    if ('Buffer' in globalThis && bytes instanceof Buffer) {
        return bytes.toString('hex');
    }
    else if ('toHex' in Uint8Array.prototype && typeof Uint8Array.prototype.toHex === 'function') {
        return Uint8Array.prototype.toHex.call(bytes);
    }
    let ans = '';
    for (const v of bytes) {
        ans += v.toString(16).padStart(2, '0');
    }
    return ans;
}
// #endregion
/**
 * @returns If `val` is an non-null object or a callable object (i.e. function).
 */
export function isObject(val) {
    return typeof val === 'function' || (!!val && typeof val === 'object');
}
export function normalizeUriPathname(pathname) {
    // Normalize drive letters on Windows to use lowercase letters, and ensure all colons are not encoded.
    // See also LSP spec text, quoted below.
    //
    // > Care should be taken to handle encoding in URIs. For example, some clients (such as VS Code) may
    // > encode colons in drive letters while others do not. The URIs below are both valid, but clients and
    // > servers should be consistent with the form they use themselves to ensure the other party doesn’t
    // > interpret them as distinct URIs. Clients and servers should not assume that each other are encoding
    // > the same way (for example a client encoding colons in drive letters cannot assume server responses
    // > will have encoded colons). The same applies to casing of drive letters - one party should not assume
    // > the other party will return paths with drive letters cased the same as itself.
    // > -- https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#uri
    return pathname
        .replace(/%3A/gi, ':')
        .replace(/^\/[A-Z]:\//, (match) => match.toLowerCase());
}
export function normalizeUri(uri) {
    const obj = new Uri(uri);
    obj.pathname = normalizeUriPathname(obj.pathname);
    return obj.toString();
}
export async function getSha1(data) {
    if (typeof data === 'string') {
        data = new TextEncoder().encode(data);
    }
    const hash = await crypto.subtle.digest('SHA-1', data.buffer);
    return bytesToHex(new Uint8Array(hash));
}
export function compressBytes(bytes, algorithm) {
    return streamToBytes(compressStream(bytesToStream(bytes), algorithm));
}
export function compressStream(stream, algorithm) {
    return stream.pipeThrough(new CompressionStream(algorithm));
}
export function decompressBytes(bytes, algorithm) {
    return streamToBytes(decompressStream(bytesToStream(bytes), algorithm));
}
export function decompressStream(stream, algorithm) {
    return stream.pipeThrough(new DecompressionStream(algorithm));
}
export function bytesToStream(bytes) {
    return new Blob([bytes]).stream();
}
export function streamToBytes(stream) {
    return new Response(stream).bytes();
}
export function sleep(delayMs) {
    return new Promise(resolve => setTimeout(resolve, delayMs));
}
/**
 * Checks if the numeric value of a number or bigint is the same. Undefined is **not** the same as
 * 0 for this function.
 * @param a The first number to compare
 * @param b The second number to compare
 * @returns True if the numeric falue is equal, false otherwise.
 */
export function numericEquals(a, b) {
    return tryConvertToNumberWithoutPrecisionLoss(a) === tryConvertToNumberWithoutPrecisionLoss(b);
}
/**
 * Tries to convert a numeric type to number if that is possible without precision loss.
 * Undefined stays untouched.
 * @param n The numeric value
 * @returns The numeric value converted to a number if there was no precision loss, the given value
 * otherwise
 */
export function tryConvertToNumberWithoutPrecisionLoss(n) {
    if (typeof n === 'bigint') {
        const num = Number(n);
        if (BigInt(num) === n) {
            return num;
        }
    }
    return n;
}
/**
 * Compares two numeric types and finds the smallest
 * @param a The first value
 * @param b The second value
 * @returns The smaller value of `a` and `b`
 */
export function min(a, b) {
    return a < b ? a : b;
}
/**
 * Compares two numeric types and finds the biggest
 * @param a The first value
 * @param b The second value
 * @returns The bigger value of `a` and `b`
 */
export function max(a, b) {
    return a > b ? a : b;
}
//# sourceMappingURL=util.js.map