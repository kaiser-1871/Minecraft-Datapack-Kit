import externalBinarySearch from 'binary-search';
import type { AstNode } from '../node/index.js';
import type { ProcessorContext } from '../service/index.js';
import type { DeepReadonly, ReadWrite } from './ReadonlyProxy.js';
export declare const Uri: {
    new (url: string | URL, base?: string | URL): URL;
    prototype: URL;
    canParse(url: string | URL, base?: string | URL): boolean;
    createObjectURL(obj: Blob | MediaSource): string;
    parse(url: string | URL, base?: string | URL): URL | null;
    revokeObjectURL(url: string): void;
};
export type Uri = URL;
/**
 * `NodeJS.Timeout` on Node.js and `number` on browser.
 */
export type IntervalId = any;
export type DeepPartial<T> = T extends object ? {
    [P in keyof T]?: DeepPartial<T[P]>;
} : T;
/**
 * @param getKey A function that takes the actual arguments being passed into the decorated method, and returns anything.
 * The result of this function will be used as the key to identify the `Promise`. By default the first element in the argument
 * list will be used.
 *
 * This is a decorator for async methods. Decorated methods will return the same `Promise` for
 * the same key, provided that the previously returned `Promise` is still pending.
 */
export declare function SingletonPromise(getKey?: (args: any[]) => any): MethodDecorator;
/**
 * This is a decorator for methods. Decorated methods will return the same non-`undefined` value no matter what.
 */
export declare const Singleton: MethodDecorator;
/**
 * @param getKey A function that takes the actual arguments being passed into the decorated method, and returns anything.
 * The result of this function will be used as the key to cache the `Timeout`. By default the first element in the argument
 * list will be used.
 *
 * Decorated methods will be scheduled to run after `ms` milliseconds. The timer will reset when the method is called again.
 */
export declare function Delay(ms: number, getKey?: (args: any[]) => any): MethodDecorator;
export type FullResourceLocation = `${string}:${string}`;
export interface ResourceLocation {
    isTag: boolean;
    namespace: string | undefined;
    path: readonly string[];
}
export declare namespace ResourceLocation {
    /**
     * The prefix for tags.
     */
    const TagPrefix = "#";
    /**
     * The seperator of namespace and path.
     */
    const NamespacePathSep = ":";
    /**
     * The seperator between different path segments.
     */
    const PathSep = "/";
    const DefaultNamespace = "minecraft";
    function lengthen(value: string): FullResourceLocation;
    function shorten(value: string): string;
}
/**
 * @returns The string value decoded from the buffer according to UTF-8.
 * Byte order mark is correctly removed.
 */
export declare function bufferToString(buffer: Uint8Array): string;
export type Arrayable<T> = T | readonly T[];
export declare namespace Arrayable {
    function is<T>(value: unknown, isT: (value: unknown) => value is T): value is Arrayable<T>;
    function toArray<T>(value: Arrayable<T>): T[];
}
export declare namespace TypePredicates {
    function isString(value: unknown): value is string;
}
export declare function promisifyAsyncIterable<T, U>(iterable: AsyncIterable<T>, joiner: (chunks: T[]) => U): Promise<U>;
export declare function parseGzippedJson(bytes: Uint8Array<ArrayBuffer>): Promise<unknown>;
/**
 * @returns Is Plain Old JavaScript Object (POJO).
 */
export declare function isPojo(value: unknown): value is Record<string, unknown>;
export declare function merge<T extends Record<string, any>>(a: T, b: Record<string, any>): T;
export type Lazy<T> = T | Lazy.ComplexLazy<T>;
export declare namespace Lazy {
    const LazyDiscriminator: unique symbol;
    export type UnresolvedLazy<T> = {
        discriminator: typeof LazyDiscriminator;
        getter: (this: void) => T;
    };
    export type ResolvedLazy<T> = {
        discriminator: typeof LazyDiscriminator;
        getter: (this: void) => T;
        value: T;
    };
    export type ComplexLazy<T> = ResolvedLazy<T> | UnresolvedLazy<T>;
    export function create<T>(getter: (this: void) => T): UnresolvedLazy<T>;
    export function isComplex<T = any>(lazy: any): lazy is ComplexLazy<T>;
    export function isUnresolved<T = any>(lazy: any): lazy is UnresolvedLazy<T>;
    export function resolve<T>(lazy: Lazy<T>): T;
    export {};
}
/**
 * @param ids An array of block/fluid IDs, with or without the namespace.
 * @returns A map from state names to the corresponding sets of values. The first element in the value array is the default
 * value for that state.
 */
export declare function getStates(category: 'block' | 'fluid', ids: readonly string[], ctx: ProcessorContext): Record<string, string[]>;
export declare const binarySearch: typeof externalBinarySearch;
export declare function isIterable(value: unknown): value is Iterable<unknown>;
export declare function getOrInsert<K, V>(map: Map<K, V>, key: K, defaultValue: V): V;
export declare function getOrInsertComputed<K, V>(map: Map<K, V>, key: K, callbackFunction: (key: K) => V): V;
/**
 * TODO: replace with ESNext Uint8Array.prototype.toHex once it's widely supported
 */
export declare function bytesToHex(bytes: Uint8Array): string;
/**
 * @returns If `val` is an non-null object or a callable object (i.e. function).
 */
export declare function isObject(val: unknown): val is object;
export declare function normalizeUriPathname(pathname: string): string;
export declare function normalizeUri(uri: string): string;
export declare function getSha1(data: string | Uint8Array<ArrayBuffer>): Promise<string>;
export declare function compressBytes(bytes: Uint8Array<ArrayBuffer>, algorithm: CompressionFormat): Promise<Uint8Array<ArrayBuffer>>;
export declare function compressStream(stream: ReadableStream<Uint8Array<ArrayBuffer>>, algorithm: CompressionFormat): ReadableStream<Uint8Array<ArrayBuffer>>;
export declare function decompressBytes(bytes: Uint8Array<ArrayBuffer>, algorithm: CompressionFormat): Promise<Uint8Array<ArrayBuffer>>;
export declare function decompressStream(stream: ReadableStream<Uint8Array<ArrayBuffer>>, algorithm: CompressionFormat): ReadableStream<Uint8Array<ArrayBuffer>>;
export declare function bytesToStream(bytes: Uint8Array<ArrayBuffer>): ReadableStream<Uint8Array<ArrayBuffer>>;
export declare function streamToBytes(stream: ReadableStream<Uint8Array<ArrayBuffer>>): Promise<Uint8Array<ArrayBuffer>>;
export declare function sleep(delayMs: number): Promise<void>;
/**
 * Return a read-write TARGET type if the INPUT type is read-write, and a
 * readonly TARGET type if the INPUT type is readonly, and `never` if the INPUT
 * type is `undefined`.
 *
 * It is used in the return type of an AST node
 * [user-defined type guard](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates).
 *
 * @example
 * ```ts
 * export namespace CommentNode {
 * 	export function is<T extends DeepReadonly<AstNode> | undefined>(
 * 		obj: T,
 * 	): obj is InheritReadonly<CommentNode, T> {
 * 		return (obj as CommentNode | undefined)?.type === 'comment'
 * 	}
 * }
 * ```
 */
export type InheritReadonly<TARGET extends AstNode, INPUT extends DeepReadonly<AstNode> | undefined> = INPUT & (INPUT extends ReadWrite<AstNode> ? TARGET : DeepReadonly<TARGET>);
/**
 * Checks if the numeric value of a number or bigint is the same. Undefined is **not** the same as
 * 0 for this function.
 * @param a The first number to compare
 * @param b The second number to compare
 * @returns True if the numeric falue is equal, false otherwise.
 */
export declare function numericEquals(a: bigint | number | undefined, b: bigint | number | undefined): boolean;
/**
 * Tries to convert a numeric type to number if that is possible without precision loss.
 * Undefined stays untouched.
 * @param n The numeric value
 * @returns The numeric value converted to a number if there was no precision loss, the given value
 * otherwise
 */
export declare function tryConvertToNumberWithoutPrecisionLoss<T extends (number | bigint | undefined)>(n: T): number | T;
/**
 * Compares two numeric types and finds the smallest
 * @param a The first value
 * @param b The second value
 * @returns The smaller value of `a` and `b`
 */
export declare function min<T extends (number | bigint)>(a: T, b: T): T;
/**
 * Compares two numeric types and finds the biggest
 * @param a The first value
 * @param b The second value
 * @returns The bigger value of `a` and `b`
 */
export declare function max<T extends (number | bigint)>(a: T, b: T): T;
//# sourceMappingURL=util.d.ts.map