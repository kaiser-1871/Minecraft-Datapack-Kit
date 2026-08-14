const isCommandLike = (node) => node.type === 'mcfunction:command' || node.type === 'mcfunction:macro';
const report = (ctx, node, key, msg) => {
    const version = ctx.project['loadedVersion'] ?? ctx.config.env.gameVersion;
    ctx.err.lint(`[gotcha] (${key}) ${version}: ${msg}`, node);
};
const particleBareId = (node, ctx) => {
    const m = ctx.src.slice(node.range).match(/\bparticle\s+minecraft:(item|block)\s+[a-z0-9_:]+/);
    if (m) {
        report(ctx, node, 'particle-bare-id', `the parameterized particle ${m[1]} needs map syntax ({item:...}/{block_state:...}); a bare ID stops the whole function from loading`);
    }
};
const nbtFieldCasing = (node, ctx) => {
    const text = ctx.src.slice(node.range);
    if (!/\bsummon\b/.test(text)) {
        return;
    }
    const m = text.match(/\b(tags|duration|wait_time|silent|radius|age|health|custom_name|invisible)\s*:/);
    if (m) {
        const fixed = m[1][0].toUpperCase() + m[1].slice(1);
        report(ctx, node, 'nbt-field-casing', `entity NBT fields are PascalCase (e.g. ${m[1]} → ${fixed}); lowercase/snake_case is silently ignored in summon`);
    }
};
const attributeMultiplier = (node, ctx) => {
    const m = ctx.src.slice(node.range).match(/\battribute\s+(\S+)\s+(\S+)\s+modifier\s+add\s+\S+\s+(-?[\d.]+)\s+(add_multiplied_base|add_multiplied_total)\b/);
    if (!m) {
        return;
    }
    const attr = m[2].replace(/^minecraft:/, '');
    const value = Number(m[3]);
    const isSpeedFamily = /(speed|efficiency|jump_strength|scale|gravity|step_height|block_break|mining)/.test(attr);
    if (isSpeedFamily && value > 0 && value < 1) {
        report(ctx, node, 'attribute-multiplier-direction', `attribute modifier ${m[4]} is a multiplier ×(1+v): v=${m[3]} → ×${(1 + value).toFixed(2)} (a boost, not a halving). Use a negative value to reduce (e.g. -0.5 → ×0.5); but negatives clamp to the attribute's minimum (e.g. movement_speed floor 0), so only small amounts behave like "halving".`);
    }
};
export function register(meta) {
    const booleanConfig = (_name, value, logger) => {
        if (typeof value !== 'boolean') {
            logger.error(`[gotcha linter] Rule "${_name}" expects a boolean value`);
            return false;
        }
        return true;
    };
    meta.registerLinter('gotchaAttributeMultiplier', {
        configValidator: booleanConfig,
        linter: attributeMultiplier,
        nodePredicate: isCommandLike,
    });
    meta.registerLinter('gotchaNbtFieldCasing', {
        configValidator: booleanConfig,
        linter: nbtFieldCasing,
        nodePredicate: isCommandLike,
    });
    meta.registerLinter('gotchaParticleBareId', {
        configValidator: booleanConfig,
        linter: particleBareId,
        nodePredicate: isCommandLike,
    });
}
//# sourceMappingURL=linter.js.map