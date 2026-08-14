# Vendored Spyglass engine

This directory contains the **built output** of the 8 `@spyglassmc/*` packages that dpkit's
engine runs on. dpkit is fully self-contained: it does not need the Spyglass source checkout
(or any npm release of these packages) to build, run, or check datapacks.

## Origin

- Upstream: [SpyglassMC/Spyglass](https://github.com/SpyglassMC/Spyglass) (MIT License,
  © SPGoding and contributors — see ./LICENSE).
- Built from a local checkout at `D:\Spyglass-main`. The upstream commit recorded at
  vendor time is `7a8d035b8247fd3539c5e9a81ba4c9552a873c34` (see BUILD.json
  `spyglassMainAtVendor.sha`); the checkout did **not** byte-match GitHub `main` HEAD as of
  the vendor date (`sourceMatchesMainHead: false`).
- Build command (run in the checkout): `npx tsgo -b packages`
  (tsgo 7.0.0-dev.20260511.1, Node >= 22.15).
- Each package ships `lib/` (JavaScript + `.d.ts`, source maps excluded) and its
  `package.json`. Inter-package dependencies resolve through dpkit's `file:` specs.

## Local patches (baked into the built JS)

These patches were applied to the checkout BEFORE building. If you re-vendor from a FRESH
upstream checkout, re-apply them first (see CLAUDE.md in the repo root for the same list):

1. `packages/core/src/service/Config.ts`
   - `LinterConfig` interface: add `gotchaAttributeMultiplier`, `gotchaNbtFieldCasing`,
     `gotchaParticleBareId` (each `LinterConfigValue<boolean>`).
   - `VanillaConfig.lint`: add the same three keys with value `'hint'`.
2. `packages/java-edition/src/mcfunction/linter.ts` — NEW file implementing dpkit's three
   mcfunction gotchas (particle-bare-id / nbt-field-casing / attribute-multiplier-direction)
   as linter rules; messages carry a `[gotcha] (<key>) <version>: ...` prefix that dpkit
   partitions into its separate gotchas report section.
3. `packages/java-edition/src/mcfunction/index.ts` — import + re-export `./linter.js` and
   call `linter.register(meta)` inside `initialize`.

## Updating the vendored engine

`npm run vendor -- --spyglass=<path-to-checkout>` rebuilds the checkout and re-syncs this
directory (refresh BUILD.json too). `node dpkit.mjs --check-updates` reports whether
Spyglass's GitHub `main` branch has moved since the last vendor.
