// logreader.ts — locate and read Minecraft logs from the official launcher, Prism Launcher,
// and TLauncher. Modeled on the behavior of minecode-mcp's minecraft_logs.py (launcher directory
// probing, latest.log-first collection, rotated *.log / *.log.gz handling, tail/head line
// selection) but written from scratch as a typed, synchronous, read-only module. The MCP
// `read_logs` tool (registered elsewhere) wraps `readGameLogs`.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import { gunzipSync } from 'node:zlib';

/** Safety cap: never return more than this many lines per file. */
export const MAX_LOG_LINES = 1000;
/** Default number of lines returned per file when `lines` is not given. */
export const DEFAULT_LOG_LINES = 100;
/** Max number of log files collected per logs directory (latest.log + rotated). */
export const MAX_LOG_FILES = 10;

export type LauncherKind = 'default' | 'prism' | 'tlauncher';

export interface GameLogEntry {
  /** Prism instance name (only present for Prism Launcher entries). */
  instance?: string;
  /** Log file basename (e.g. latest.log, 2024-01-01-1.log.gz). */
  file: string;
  /** Absolute path to the on-disk log file. */
  path: string;
  /** On-disk file size in bytes (compressed size for .log.gz). */
  size: number;
  /** Number of lines actually returned in `content`. */
  linesShown: number;
  /** The (possibly decompressed, possibly truncated) log content. */
  content: string;
}

export interface GameLogsResult {
  success: boolean;
  /** Launcher the logs came from (resolved launcher on success; requested/auto otherwise). */
  launcher: string;
  logs: GameLogEntry[];
  /** Present when no logs could be found (lists the probed paths). */
  error?: string;
}

export interface ReadGameLogsOptions {
  /** Launcher to read from; omit to auto-detect in order prism → default → tlauncher. */
  launcher?: LauncherKind;
  /** Prism instance name (only meaningful with launcher 'prism' or auto-detect). */
  instance?: string;
  /** Number of lines to return per file (clamped to 1..MAX_LOG_LINES; default 100). */
  lines?: number;
  /** Return the last N lines (true, default) or the first N lines (false). */
  tail?: boolean;
  /** Base dir for the *default* launcher — integrates with dpkit config.minecraftRoot. */
  minecraftRoot?: string;
}

function clampLines(lines: number | undefined): number {
  if (lines === undefined || Number.isNaN(lines)) return DEFAULT_LOG_LINES;
  const n = Math.floor(lines);
  if (n < 1) return 1;
  return Math.min(n, MAX_LOG_LINES);
}

/** Split text into lines the way Python's str.splitlines() does (drops a trailing empty line). */
function splitLines(text: string): string[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

/** Base dir of the official (default) launcher, per platform. `minecraftRoot` overrides it. */
export function getDefaultMinecraftDir(minecraftRoot?: string): string {
  if (minecraftRoot) return minecraftRoot;
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || '';
    return appData ? join(appData, '.minecraft') : join(homedir(), '.minecraft');
  }
  if (process.platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'minecraft');
  }
  return join(homedir(), '.minecraft');
}

/** Base dir of the Prism Launcher, per platform. */
export function getPrismLauncherDir(): string {
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || '';
    return appData ? join(appData, 'PrismLauncher') : join(homedir(), 'PrismLauncher');
  }
  if (process.platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'PrismLauncher');
  }
  const xdg = process.env.XDG_DATA_HOME;
  return xdg ? join(xdg, 'PrismLauncher') : join(homedir(), '.local', 'share', 'PrismLauncher');
}

/** Base dir of TLauncher — it reuses the official .minecraft directory. */
export function getTLauncherDir(minecraftRoot?: string): string {
  return getDefaultMinecraftDir(minecraftRoot);
}

/** Marker files that identify a TLauncher install (it shares the .minecraft dir with default). */
function isTLauncherInstall(baseDir: string): boolean {
  return (
    existsSync(join(baseDir, 'tlauncher_profiles.json')) ||
    existsSync(join(baseDir, 'tlauncher.properties')) ||
    existsSync(join(baseDir, 'tlauncher-2.0'))
  );
}

/**
 * List a logs directory: latest.log first, then rotated *.log / *.log.gz by mtime desc.
 * Read-only: unreadable entries are skipped, not fatal.
 */
export function collectLogFiles(logsDir: string): string[] {
  if (!existsSync(logsDir)) return [];
  let names: string[];
  try {
    names = readdirSync(logsDir);
  } catch {
    return [];
  }

  const others: Array<{ path: string; mtimeMs: number }> = [];
  for (const name of names) {
    if (name === 'latest.log') continue;
    if (!name.endsWith('.log') && !name.endsWith('.log.gz')) continue;
    const p = join(logsDir, name);
    try {
      if (!statSync(p).isFile()) continue;
      others.push({ path: p, mtimeMs: statSync(p).mtimeMs });
    } catch {
      /* unreadable entry — skip */
    }
  }
  others.sort((a, b) => b.mtimeMs - a.mtimeMs);

  const files: string[] = [];
  const latest = join(logsDir, 'latest.log');
  try {
    if (existsSync(latest) && statSync(latest).isFile()) files.push(latest);
  } catch {
    /* ignore */
  }
  files.push(...others.map((x) => x.path));
  return files.slice(0, MAX_LOG_FILES);
}

/** Find Prism instances' log files: instances/<name>/{minecraft,.minecraft}/logs. */
export function findPrismLogs(
  prismDir: string,
  instance?: string,
): Array<{ instance: string; files: string[] }> {
  const instancesDir = join(prismDir, 'instances');
  if (!existsSync(instancesDir)) return [];

  let instanceNames: string[];
  if (instance) {
    instanceNames = [instance];
  } else {
    try {
      instanceNames = readdirSync(instancesDir).filter((n) => {
        try {
          return statSync(join(instancesDir, n)).isDirectory();
        } catch {
          return false;
        }
      });
    } catch {
      return [];
    }
  }

  const result: Array<{ instance: string; files: string[] }> = [];
  for (const inst of instanceNames) {
    const instanceDir = join(instancesDir, inst);
    if (!existsSync(instanceDir)) continue;
    // Prism uses "minecraft", some setups use ".minecraft" — first one with logs wins.
    for (const sub of ['minecraft', '.minecraft']) {
      const files = collectLogFiles(join(instanceDir, sub, 'logs'));
      if (files.length > 0) {
        result.push({ instance: inst, files });
        break;
      }
    }
  }
  return result;
}

/** Read one log file, decompressing .gz; returns null if it can't be read (skip, don't fail). */
export function readLogFile(
  filePath: string,
  lines: number = DEFAULT_LOG_LINES,
  tail: boolean = true,
): { content: string; linesShown: number } | null {
  const n = clampLines(lines);
  try {
    let raw: Buffer;
    if (filePath.endsWith('.gz')) {
      raw = gunzipSync(readFileSync(filePath));
    } else {
      raw = readFileSync(filePath);
    }
    const allLines = splitLines(raw.toString('utf8'));
    const selected = tail ? allLines.slice(-n) : allLines.slice(0, n);
    return { content: selected.join('\n'), linesShown: selected.length };
  } catch {
    return null;
  }
}

function safeSize(filePath: string): number {
  try {
    return statSync(filePath).size;
  } catch {
    return 0;
  }
}

function collectEntries(
  kind: LauncherKind,
  opts: ReadGameLogsOptions,
  lines: number,
  tail: boolean,
  probed: Array<{ launcher: string; path: string }>,
): GameLogEntry[] {
  const out: GameLogEntry[] = [];

  if (kind === 'prism') {
    const dir = getPrismLauncherDir();
    probed.push({ launcher: 'Prism', path: dir });
    for (const { instance, files } of findPrismLogs(dir, opts.instance)) {
      for (const file of files) {
        const read = readLogFile(file, lines, tail);
        if (!read) continue;
        out.push({
          instance,
          file: basename(file),
          path: file,
          size: safeSize(file),
          linesShown: read.linesShown,
          content: read.content,
        });
      }
    }
    return out;
  }

  if (kind === 'tlauncher') {
    const dir = getTLauncherDir(opts.minecraftRoot);
    probed.push({ launcher: 'TLauncher', path: dir });
    if (!isTLauncherInstall(dir)) return out;
    for (const file of collectLogFiles(join(dir, 'logs'))) {
      const read = readLogFile(file, lines, tail);
      if (!read) continue;
      out.push({
        file: basename(file),
        path: file,
        size: safeSize(file),
        linesShown: read.linesShown,
        content: read.content,
      });
    }
    return out;
  }

  // default launcher
  const dir = getDefaultMinecraftDir(opts.minecraftRoot);
  probed.push({ launcher: 'Default', path: dir });
  for (const file of collectLogFiles(join(dir, 'logs'))) {
    const read = readLogFile(file, lines, tail);
    if (!read) continue;
    out.push({
      file: basename(file),
      path: file,
      size: safeSize(file),
      linesShown: read.linesShown,
      content: read.content,
    });
  }
  return out;
}

/** Locate and read Minecraft logs across launchers (default / Prism / TLauncher). */
export function readGameLogs(opts: ReadGameLogsOptions = {}): GameLogsResult {
  const lines = clampLines(opts.lines);
  const tail = opts.tail ?? true;
  const kinds: LauncherKind[] = opts.launcher ? [opts.launcher] : ['prism', 'default', 'tlauncher'];
  const probed: Array<{ launcher: string; path: string }> = [];
  const logs: GameLogEntry[] = [];
  let resolved: LauncherKind | null = null;

  for (const kind of kinds) {
    const collected = collectEntries(kind, opts, lines, tail, probed);
    if (collected.length > 0) {
      resolved = kind;
      logs.push(...collected);
      break;
    }
  }

  if (logs.length > 0) {
    return { success: true, launcher: resolved ?? opts.launcher ?? 'auto', logs };
  }

  return {
    success: false,
    launcher: opts.launcher ?? 'auto-detect',
    logs: [],
    error:
      'No Minecraft logs found. Checked paths:\n' +
      probed.map((p) => `- ${p.launcher}: ${p.path}`).join('\n'),
  };
}
