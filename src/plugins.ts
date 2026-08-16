// plugins.ts — the dpkit plugin API.
//
// Inspired by Beet's plugin/Context model: the core tool owns the pipeline and plugins
// get stable hooks around it. A plugin can inspect the collected file set before the
// check runs and can add/transform issues after the report is assembled.
//
// Plugins are plain objects:
//
//   export default {
//     name: 'my-rule',
//     beforeCheck(ctx) { /* e.g. log the file set */ },
//     afterCheck({ report }) {
//       report.issues.push({ file: 'pack.mcmeta', line: 1, char: 0, severity: 'W', message: 'hello' });
//     },
//   };
//
// They can be passed through the API (`plugins: [...]`), loaded from .dpkit.json
// (`"plugins": ["./tools/dpkit-plugin.mjs"]`), or from the CLI (`--plugin=./plugin.mjs`).
import { isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { CheckOptions, CheckReport } from './api.js';

/** What a plugin can see at a check boundary. */
export interface PluginContext {
  /** The datapack path the user passed (a .zip stays the original path here). */
  datapack: string;
  /** The directory actually checked (extracted root for .zip datapacks). */
  workRoot: string;
  /** The raw version specifier ('auto', '1.21.4', ...). */
  version: string;
  /** The concrete version when known before/after the engine run. */
  resolvedVersion: string | null;
  /** Absolute paths of every file in the check set (including pack.mcmeta). */
  files: string[];
  /** data/-relative paths matching `files` (pack.mcmeta is 'pack.mcmeta'). */
  rels: string[];
  /** The original check options (read-only; do not mutate). */
  opts: Readonly<CheckOptions>;
}

export interface DpkitPlugin {
  /** Stable plugin name, used in error messages. */
  name: string;
  /** Called once per check before beforeCheck. */
  setup?(ctx: PluginContext): void | Promise<void>;
  /** Called after file collection / version resolution, before the engine runs. */
  beforeCheck?(ctx: PluginContext): void | Promise<void>;
  /**
   * Called after the report is assembled. May mutate `report` and return nothing, or
   * return a replacement report. Use the exported `addIssue` helper to keep counts correct.
   */
  afterCheck?(ctx: PluginContext & { report: CheckReport }): void | CheckReport | Promise<void | CheckReport>;
}

/** Add an issue to an assembled report and keep summary counts in sync. */
export function addIssue(
  report: CheckReport,
  file: string,
  line: number,
  char: number,
  severity: 'E' | 'W' | '·',
  message: string,
): void {
  report.issues.push({ file, line, char, severity, message });
  if (severity === 'E') report.summary.errors++;
  else if (severity === 'W') report.summary.warnings++;
}

/** Run the setup phase for every plugin in order. */
export async function initPlugins(plugins: DpkitPlugin[], ctx: PluginContext): Promise<void> {
  for (const plugin of plugins) {
    if (plugin.setup) await plugin.setup(ctx);
  }
}

/** Run the beforeCheck phase for every plugin in order. */
export async function runBeforeCheck(plugins: DpkitPlugin[], ctx: PluginContext): Promise<void> {
  for (const plugin of plugins) {
    if (plugin.beforeCheck) await plugin.beforeCheck(ctx);
  }
}

/** Run the afterCheck phase; returns the final report (possibly replaced by a plugin). */
export async function runAfterCheck(
  plugins: DpkitPlugin[],
  ctx: PluginContext,
  report: CheckReport,
): Promise<CheckReport> {
  let current = report;
  for (const plugin of plugins) {
    if (!plugin.afterCheck) continue;
    const next = await plugin.afterCheck({ ...ctx, report: current });
    if (next) current = next;
  }
  return current;
}

/**
 * Load plugin modules from file paths. Each module may default-export the plugin, export a
 * named `plugin`, or export a factory function that returns a plugin.
 */
export async function loadPluginModules(specs: string[], baseDir: string): Promise<DpkitPlugin[]> {
  const plugins: DpkitPlugin[] = [];
  for (const spec of specs) {
    const resolved = isAbsolute(spec) ? spec : resolve(baseDir, spec);
    let mod: unknown;
    try {
      mod = await import(pathToFileURL(resolved).href);
    } catch (err) {
      throw new Error(`[plugin] could not load ${spec}: ${(err as Error).message}`);
    }
    let plugin: unknown = (mod as { default?: unknown; plugin?: unknown }).default
      ?? (mod as { plugin?: unknown }).plugin
      ?? mod;
    if (typeof plugin === 'function') {
      try {
        plugin = await (plugin as () => unknown)();
      } catch (err) {
        throw new Error(`[plugin] factory ${spec} threw: ${(err as Error).message}`);
      }
    }
    if (!plugin || typeof (plugin as { name?: unknown }).name !== 'string') {
      throw new Error(`[plugin] ${spec} does not export a plugin object with a string "name"`);
    }
    plugins.push(plugin as DpkitPlugin);
  }
  return plugins;
}
