import type { FullResourceLocation } from '@spyglassmc/core';
import { RangeKind } from '../node/index.js';
export * from './reference.js';
export type Attributes = Attribute[];
export declare namespace Attributes {
    function equals(a: Attributes | undefined, b: Attributes | undefined): boolean;
}
export interface Attribute {
    name: string;
    value?: AttributeValue;
}
export declare namespace Attribute {
    function equals(a: Attribute, b: Attribute): boolean;
}
export type AttributeValue = McdocType | AttributeTreeValue;
export interface AttributeTreeValue {
    kind: 'tree';
    values: AttributeTree;
}
export interface AttributeTree {
    [key: string | number]: AttributeValue;
}
export declare namespace AttributeValue {
    function equals(a: AttributeValue, b: AttributeValue): boolean;
}
export interface NumericRange<T extends (number | bigint) = (number | bigint)> {
    kind: RangeKind;
    min?: T;
    max?: T;
}
export declare namespace NumericRange {
    function isInRange<T extends (number | bigint) = (number | bigint)>(range: NumericRange<T>, val: T): boolean;
    function equals(a: NumericRange, b: NumericRange): boolean;
    function intersect<T extends (number | bigint) = number>(a: NumericRange<T>, b: NumericRange<T>): NumericRange<T>;
    function toString({ kind, min, max }: NumericRange): string;
}
export declare const StaticIndexKeywords: readonly ["fallback", "none", "unknown", "spawnitem", "blockitem"];
export type StaticIndexKeyword = (typeof StaticIndexKeywords)[number];
export interface StaticIndex {
    kind: 'static';
    value: string;
}
export interface DynamicIndex {
    kind: 'dynamic';
    accessor: (string | {
        keyword: 'key' | 'parent';
    })[];
}
export type Index = StaticIndex | DynamicIndex;
/**
 * Corresponds to the IndexBodyNode
 */
export type ParallelIndices = Index[];
export declare namespace ParallelIndices {
    function equals(a: ParallelIndices, b: ParallelIndices): boolean;
}
export interface DispatcherData {
    registry: FullResourceLocation;
    parallelIndices: ParallelIndices;
}
export interface DispatcherType extends DispatcherData, McdocBaseType {
    kind: 'dispatcher';
}
export interface StructType extends McdocBaseType {
    kind: 'struct';
    fields: StructTypeField[];
}
export type StructTypeField = StructTypePairField | StructTypeSpreadField;
export interface StructTypePairField extends McdocBaseType {
    kind: 'pair';
    key: string | McdocType;
    type: McdocType;
    optional?: boolean;
    deprecated?: boolean;
    desc?: string;
}
export interface StructTypeSpreadField extends McdocBaseType {
    kind: 'spread';
    type: McdocType;
}
export type EnumType = NumberEnumType | LongEnumType | StringEnumType | InvalidEnumType;
interface EnumTypeBase extends McdocBaseType {
    kind: 'enum';
}
interface NumberEnumType extends EnumTypeBase {
    enumKind: 'byte' | 'short' | 'int' | 'float' | 'double';
    values: EnumTypeField<number>[];
}
interface LongEnumType extends EnumTypeBase {
    enumKind: 'long';
    values: EnumTypeField<bigint>[];
}
interface StringEnumType extends EnumTypeBase {
    enumKind: 'string';
    values: EnumTypeField<string>[];
}
interface InvalidEnumType extends EnumTypeBase {
    enumKind: undefined;
    values: EnumTypeField<string | number | bigint>[];
}
export interface EnumTypeField<T> extends McdocBaseType {
    identifier: string;
    value: T;
    desc?: string;
}
export interface ReferenceType extends McdocBaseType {
    kind: 'reference';
    path?: string;
}
export interface UnionType<T extends McdocType = McdocType> extends McdocBaseType {
    kind: 'union';
    members: T[];
}
export interface IndexedType extends McdocBaseType {
    kind: 'indexed';
    parallelIndices: Index[];
    child: McdocType;
}
export interface TemplateType extends McdocBaseType {
    kind: 'template';
    child: McdocType;
    typeParams: {
        path: string;
    }[];
}
export interface ConcreteType extends McdocBaseType {
    kind: 'concrete';
    child: McdocType;
    typeArgs: McdocType[];
}
export interface MappedType extends McdocBaseType {
    kind: 'mapped';
    child: McdocType;
    mapping: {
        [path: string]: McdocType;
    };
}
export declare const EmptyUnion: UnionType<never>;
export declare function createEmptyUnion(attributes?: Attributes): UnionType<never>;
export interface KeywordType extends McdocBaseType {
    kind: 'any' | 'boolean' | 'unsafe';
}
export interface StringType extends McdocBaseType {
    kind: 'string';
    lengthRange?: NumericRange<number>;
}
export type LiteralValue = LiteralBooleanValue | LiteralStringValue | LiteralNumericValue | LiteralLongNumberValue;
export interface LiteralBooleanValue {
    kind: 'boolean';
    value: boolean;
}
export interface LiteralStringValue {
    kind: 'string';
    value: string;
}
export interface LiteralNumericValue {
    kind: Exclude<NumericTypeKind, 'long'>;
    value: number;
}
export interface LiteralLongNumberValue {
    kind: 'long';
    value: bigint;
}
export declare namespace LiteralNumericValue {
    function makeIfValid(kind: string, value: number | bigint, allowInt?: boolean, allowFloat?: boolean): LiteralNumericValue | LiteralLongNumberValue | undefined;
}
export interface LiteralType extends McdocBaseType {
    kind: 'literal';
    value: LiteralValue;
}
export interface NumericType extends McdocBaseType {
    kind: Exclude<NumericTypeKind, 'long'>;
    valueRange?: NumericRange<number>;
}
export interface LongType extends McdocBaseType {
    kind: 'long';
    valueRange?: NumericRange<bigint>;
}
export declare const NumericTypeIntKinds: readonly ["byte", "short", "int", "long"];
export type NumericTypeIntKind = (typeof NumericTypeIntKinds)[number];
export declare const NumericTypeFloatKinds: readonly ["float", "double"];
export type NumericTypeFloatKind = (typeof NumericTypeFloatKinds)[number];
export declare const NumericTypeKinds: readonly ["byte", "short", "int", "long", "float", "double"];
export type NumericTypeKind = (typeof NumericTypeKinds)[number];
export type PrimitiveArrayType = SmallIntArrayType | LongArrayType;
export interface SmallIntArrayType extends McdocBaseType {
    kind: 'byte_array' | 'int_array';
    valueRange?: NumericRange<number>;
    lengthRange?: NumericRange<number>;
}
export interface LongArrayType extends McdocBaseType {
    kind: 'long_array';
    valueRange?: NumericRange<bigint>;
    lengthRange?: NumericRange<number>;
}
export declare const PrimitiveArrayValueKinds: readonly ["byte", "int", "long"];
export type PrimitiveArrayValueKind = (typeof PrimitiveArrayValueKinds)[number];
export declare const PrimitiveArrayKinds: readonly ("byte_array" | "int_array" | "long_array")[];
export type PrimitiveArrayKind = (typeof PrimitiveArrayKinds)[number];
export interface ListType extends McdocBaseType {
    kind: 'list';
    item: McdocType;
    lengthRange?: NumericRange<number>;
}
export interface TupleType extends McdocBaseType {
    kind: 'tuple';
    items: McdocType[];
}
export interface McdocBaseType {
    attributes?: Attributes;
}
export type McdocType = DispatcherType | EnumType | KeywordType | ListType | LiteralType | NumericType | LongType | PrimitiveArrayType | ReferenceType | StringType | StructType | TupleType | UnionType | IndexedType | TemplateType | ConcreteType | MappedType;
export declare namespace McdocType {
    function equals(a: McdocType, b: McdocType): boolean;
    function toString(type: McdocType | undefined): string;
}
//# sourceMappingURL=index.d.ts.map