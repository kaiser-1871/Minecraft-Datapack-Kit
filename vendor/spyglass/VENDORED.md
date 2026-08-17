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
4. `packages/language-server/src/server.ts` (built output: `language-server/lib/server.js`) —
   the `configChanged` watcher used `Set.prototype.isSubsetOf`, an ES2024 API that does not
   exist on Node 20 (the LSP server crashed with `oldExclude.isSubsetOf is not a function`
   on Node 20 CI runs). Replaced with the equivalent ES2020 form:
   `[...oldExclude].every(v => newExclude.has(v))`.

## dpkit-side build patch (not baked into the checkout)

`packages/core/package.json` still lists `decompress` upstream, but dpkit does **not** install
or bundle it: dpkit removes `decompress` / `@types/decompress` from `vendor/spyglass/core/package.json`
and `scripts/build-bundle.mjs` aliases the `decompress` import to `scripts/safe-decompress.mjs`
(a safe in-memory tar extractor). This avoids the known zip-slip CVEs in `decompress@4.2.1`.
If you re-vendor from a fresh checkout, re-apply this package.json edit and keep the esbuild alias.

## Updating the vendored engine

`npm run vendor -- --spyglass=<path-to-checkout>` rebuilds the checkout and re-syncs this
directory (refresh BUILD.json too). `node dpkit.mjs --check-updates` reports whether
Spyglass's GitHub `main` branch has moved since the last vendor.
