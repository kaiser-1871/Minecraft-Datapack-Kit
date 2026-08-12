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
}

/** Locate the config file to use, or null when none is configured. */
export function findConfigFile(explicit?: string): string | null {
  if (explicit) {
    if (existsSync(explicit)) return explicit;
    throw new Error(`[dpkit] --config 文件不存在: ${explicit}`);
  }
  for (const c of [
    process.env.DPKIT_CONFIG,
    join(process.cwd(), CONFIG_FILENAME),
    join(homedir(), CONFIG_FILENAME),
  ]) {
    if (!c) continue;
    try { if (existsSync(c)) return c; } catch { /* skip unreadable candidate */ }
  }
  return null;
}

/** Read + validate the config file. Returns {} and path:null when none is configured. */
export function loadConfig(explicit?: string): { config: DpkitConfig; path: string | null } {
  const path = findConfigFile(explicit);
  if (!path) return { config: {}, path: null };
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
    const cfg: DpkitConfig = {};
    if (typeof raw.datapack === 'string') cfg.datapack = resolvePath(raw.datapack, path);
    if (typeof raw.version === 'string') cfg.version = raw.version;
    if (Array.isArray(raw.ignore)) cfg.ignore = raw.ignore.filter((x): x is string => typeof x === 'string');
    if (typeof raw.minecraftRoot === 'string') cfg.minecraftRoot = resolvePath(raw.minecraftRoot, path);
    if (typeof raw.baselineFile === 'string') cfg.baselineFile = resolvePath(raw.baselineFile, path);
    if (typeof raw.gotchas === 'boolean') cfg.gotchas = raw.gotchas;
    if (typeof raw.logcheck === 'boolean') cfg.logcheck = raw.logcheck;
    return { config: cfg, path };
  } catch (err) {
    throw new Error(`[dpkit] 配置文件 ${path} 无法解析: ${(err as Error).message}`);
  }
}

/** Absolute stays absolute; relative paths resolve against the config file's directory. */
function resolvePath(p: string, configFile: string): string {
  return isAbsolute(p) ? p : join(dirname(configFile), p);
}
