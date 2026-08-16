// config.ts — dpkit configuration (.dpkit.json).
//
// Lets any user point the tool at their OWN datapack / version without editing code or
// passing flags every time. The file is looked up at cwd → user home, or given
// explicitly via --config=<path> / $DPKIT_CONFIG. Precedence for every value is:
//   CLI flag  >  env var  >  this config  >  built-in default
//
// The repo ships no committed .dpkit.json — each user keeps their own in a local,
// git-ignored copy; .dpkit.example.json shows the shape.
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join } from 'node:path';
import { z } from 'zod';

/** Built-in fallback version when none is configured: 'auto' reads the checked
 * datapack's pack.mcmeta (offline syntax tools resolve it to the latest cached release). */
export const DEFAULT_VERSION = 'auto';

export const CONFIG_FILENAME = '.dpkit.json';

export interface DpkitConfig {
  /** Datapack path (absolute, or relative to the config file's directory). */
  datapack?: string;
  /** Game version to check as: 'auto' (default, reads pack.mcmeta) | 'latest release' | '1.21.4' | … */
  version?: string;
  /** Extra ignore patterns, as in --ignore: message substring, or /regex/. */
  ignore?: string[];
  /** Minecraft install root (the dir containing versions/ and logs/). */
  minecraftRoot?: string;
  /** Baseline file for --delta (relative paths resolve against the config file). */
  baselineFile?: string;
  /** Enable the gotcha heuristic scan (default true). */
  gotchas?: boolean;
  /** Enable the game-log self-check (default true). */
  logcheck?: boolean;
  /** Workspace datapacks (symbol providers only, not checked). */
  workspace?: string[];
  /** Alias for workspace. */
  additionalDatapacks?: string[];
  /** Resource packs (read-only sounds/font/lang symbol providers). */
  resourcePacks?: string[];
  /** Missing-cache behavior for pinned versions: download | fallback | fail. */
  cacheMiss?: 'download' | 'fallback' | 'fail';
  /** Known-false-positive rules: false disables all; a string array enables a subset. */
  falsePositives?: boolean | string[];
  /** Also run a full separate check for every workspace datapack. */
  checkWorkspace?: boolean;
}

/** Zod schema for .dpkit.json. `.strict()` rejects unknown keys (e.g. a typo'd "datapak")
 * and wrong types (e.g. ignore: [7]) instead of silently dropping them. */
const configSchema = z.object({
  datapack: z.string().optional(),
  version: z.string().optional(),
  ignore: z.array(z.string()).optional(),
  minecraftRoot: z.string().optional(),
  baselineFile: z.string().optional(),
  gotchas: z.boolean().optional(),
  logcheck: z.boolean().optional(),
  workspace: z.array(z.string()).optional(),
  additionalDatapacks: z.array(z.string()).optional(),
  resourcePacks: z.array(z.string()).optional(),
  cacheMiss: z.enum(['download', 'fallback', 'fail']).optional(),
  falsePositives: z.union([z.boolean(), z.array(z.string())]).optional(),
  checkWorkspace: z.boolean().optional(),
}).strict();

/** Locate the config file to use, or null when none is configured. */
export function findConfigFile(explicit?: string): string | null {
  if (explicit) {
    if (existsSync(explicit)) return explicit;
    throw new Error(`[dpkit] --config file not found: ${explicit}`);
  }
  // A typo'd DPKIT_CONFIG should fail loudly, not silently fall through to cwd/home.
  const envConfig = process.env.DPKIT_CONFIG;
  if (envConfig) {
    if (existsSync(envConfig)) return envConfig;
    throw new Error(`[dpkit] DPKIT_CONFIG file not found: ${envConfig}`);
  }
  for (const c of [join(process.cwd(), CONFIG_FILENAME), join(homedir(), CONFIG_FILENAME)]) {
    try { if (existsSync(c)) return c; } catch { /* skip unreadable candidate */ }
  }
  return null;
}

/** Read + validate the config file. Returns {} and path:null when none is configured. */
export function loadConfig(explicit?: string): { config: DpkitConfig; path: string | null } {
  const path = findConfigFile(explicit);
  if (!path) return { config: {}, path: null };
  try {
    const parsed = configSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
    const cfg: DpkitConfig = {};
    if (parsed.datapack !== undefined) cfg.datapack = resolvePath(parsed.datapack, path);
    if (parsed.version !== undefined) cfg.version = parsed.version;
    if (parsed.ignore !== undefined) cfg.ignore = parsed.ignore;
    if (parsed.minecraftRoot !== undefined) cfg.minecraftRoot = resolvePath(parsed.minecraftRoot, path);
    if (parsed.baselineFile !== undefined) cfg.baselineFile = resolvePath(parsed.baselineFile, path);
    if (parsed.gotchas !== undefined) cfg.gotchas = parsed.gotchas;
    if (parsed.logcheck !== undefined) cfg.logcheck = parsed.logcheck;
    if (parsed.workspace !== undefined) cfg.workspace = parsed.workspace.map(v => resolvePath(v, path));
    if (parsed.additionalDatapacks !== undefined) cfg.additionalDatapacks = parsed.additionalDatapacks.map(v => resolvePath(v, path));
    if (parsed.resourcePacks !== undefined) cfg.resourcePacks = parsed.resourcePacks.map(v => resolvePath(v, path));
    if (parsed.cacheMiss !== undefined) cfg.cacheMiss = parsed.cacheMiss;
    if (parsed.falsePositives !== undefined) cfg.falsePositives = parsed.falsePositives;
    if (parsed.checkWorkspace !== undefined) cfg.checkWorkspace = parsed.checkWorkspace;
    return { config: cfg, path };
  } catch (err) {
    throw new Error(`[dpkit] config file ${path} could not be parsed: ${(err as Error).message}`);
  }
}

/** Absolute stays absolute; relative paths resolve against the config file's directory. */
function resolvePath(p: string, configFile: string): string {
  return isAbsolute(p) ? p : join(dirname(configFile), p);
}
