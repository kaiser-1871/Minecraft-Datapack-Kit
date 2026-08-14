export var McdocCheckerContext;
(function (McdocCheckerContext) {
    function create(ctx, options) {
        return {
            ...ctx,
            allowMissingKeys: options.allowMissingKeys ?? false,
            requireCanonical: options.requireCanonical ?? false,
            tryConvertTo: options.tryConvertTo ?? (() => undefined),
            getChildren: options.getChildren ?? (() => []),
            reportError: options.reportError ?? (() => { }),
            attachTypeInfo: options.attachTypeInfo,
            nodeAttacher: options.nodeAttacher,
            stringAttacher: options.stringAttacher,
        };
    }
    McdocCheckerContext.create = create;
})(McdocCheckerContext || (McdocCheckerContext = {}));
//# sourceMappingURL=context.js.map