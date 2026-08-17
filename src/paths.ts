// paths.ts — repo-relative paths. At runtime the compiled code lives in dist/,
// so ROOT_DIR is one level up from import.meta.url.
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

/** Repo root (has trailing separator). */
export const ROOT_DIR = fileURLToPath(new URL('../', import.meta.url));

/** The Spyglass LSP server entry (used by the --engine=lsp fallback). */
export const SERVER = join(ROOT_DIR, 'dist', 'spyglass-server.js');

/** Baseline file for --delta. Defaults to the current working directory, not the package
 * install root, so `npm i -g dpkit-mc` users can actually read/write it. Users can still
 * override with --baseline or config `baselineFile`. */
export const BASELINE_FILE = join(process.cwd(), '.dpkit-baseline.json');
