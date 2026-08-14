const TypeReferences = {
    'item_count_predicate': '::java::world::component::predicate::ItemCountPseudoPredicate',
    'pack_meta': '::java::pack::Pack',
    'tag': '::java::data::tag::Tag',
    'text_component': '::java::util::text::Text',
    'text_style': '::java::util::text::TextStyle',
};
export function typeRefPath(key) {
    return TypeReferences[key];
}
export function typeRef(key) {
    return { kind: 'reference', path: TypeReferences[key] };
}
//# sourceMappingURL=reference.js.map