import type { ReferenceType } from './index.js';
declare const TypeReferences: {
    readonly item_count_predicate: '::java::world::component::predicate::ItemCountPseudoPredicate';
    readonly pack_meta: '::java::pack::Pack';
    readonly tag: '::java::data::tag::Tag';
    readonly text_component: '::java::util::text::Text';
    readonly text_style: '::java::util::text::TextStyle';
};
export type TypeReferenceKey = keyof typeof TypeReferences;
export declare function typeRefPath(key: TypeReferenceKey): `::${string}::${string}`;
export declare function typeRef(key: TypeReferenceKey): ReferenceType;
export {};
//# sourceMappingURL=reference.d.ts.map