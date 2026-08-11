// paths.ts — repo-relative paths. At runtime the compiled code lives in dist/,
// so ROOT_DIR is one level up from import.meta.url.
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

/** Repo root (has trailing separator). */
export const ROOT_DIR = fileURLToPath(new URL('../', import.meta.url));

/** The Spyglass LSP server entry (used by the --engine=lsp fallback). */
export const SERVER = join(ROOT_DIR, 'node_modules', '@spyglassmc', 'language-server', 'bin', 'server.js');

/** Baseline file for --delta. */
export const BASELINE_FILE = join(ROOT_DIR, '.dpkit-baseline.json');

/** Legacy relative default datapack (breaks when the tool moves). */
export const LEGACY_DEFAULT_DATAPACK = join(ROOT_DIR, '..', 'datapacks', 'pvp');
