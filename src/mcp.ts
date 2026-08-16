// mcp.ts — an MCP (Model Context Protocol) stdio server exposing dpkit's capabilities
// as tools, so AI IDEs and coding agents (any MCP client) can call the real Spyglass/DHP engine
// instead of guessing per-version syntax. Each tool call boots a fresh engine (v1); a
// long-lived pooled project is a possible v2 optimization.
//
// Defaults follow .dpkit.json (cwd → home, or $DPKIT_CONFIG) so any user can point the
// tools at their own datapack/version. Precedence: per-call arg > $DPKIT_DATAPACK /
// $DPKIT_VERSION > .dpkit.json > built-in default.
//
// Output shaping: every success response is an ENVELOPE — it keeps the pre-existing top-level
// JSON shape and only ADDS ok:true plus count/total/truncated/hint metadata, and truncates
// oversized arrays (see src/mcp-shape.ts). Errors keep the legacy {error} JSON + isError:true.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as api from './api.js';
import { DEFAULT_VERSION, loadConfig } from './config.js';
import { detectDefaultDatapack } from './datapack-discovery.js';
import { ensureVersionData } from './version-data.js';
import { errResult, jsonResult, ok, truncate } from './mcp-shape.js';
import { registerWorkflowPrompt } from './prompt-workflow.js';
import { readGameLogs } from './logreader.js';
import { ensureBlockStates, getBlockStates, listBlockStates } from './block-states.js';
import { ensureVanillaData, getVanillaFile, searchVanillaFiles, VANILLA_CATEGORIES } from './vanilla-data.js';
import { CommandDataNotCachedError } from './syntax.js';

export async function main(): Promise<void> {
  let cfg;
  try { cfg = loadConfig().config; } catch (e) { console.error((e as Error).message); process.exit(1); }

  // One pooled engine shared across all tool calls (its own per-datapack@@version Service cache),
  // so repeated check_datapack / complete_at calls skip the init()+ready() cost. A per-call
  // 'inproc'/'lsp' string still builds a one-shot engine.
  const pooledEngine = api.createInProcEnginePool();
  const pickEngine = (e?: 'inproc' | 'lsp' | 'pool') => (e === 'inproc' || e === 'lsp' ? e : pooledEngine);

  // Empty-string env vars mean "unset" (same rule as the CLI): '' must not beat the config.
  const defaultDatapack = (version: string): string =>
    (process.env.DPKIT_DATAPACK?.trim() || undefined) ?? cfg.datapack ?? detectDefaultDatapack(version, cfg.minecraftRoot)
    ?? '';
  const ver = (v?: string): string => v ?? (process.env.DPKIT_VERSION?.trim() || undefined) ?? cfg.version ?? DEFAULT_VERSION;

  const server = new McpServer({
    name: 'dpkit',
    version: '1.0.0',
    description:
      'Minecraft datapack tooling backed by the Spyglass/DHP engine. check_datapack finds real errors; query_syntax returns ' +
      'exact per-version command grammar; complete_at gives cursor-position completions. Check syntax with query_syntax before ' +
      'writing or fixing a command.',
  });

  server.registerTool('check_datapack', {
    description:
      'Check a Minecraft datapack (directory or .zip) with the Spyglass/DHP engine and return a structured report: diagnostics, known-false-positive ' +
      'ignores (LastHurtMob), known-gotcha hints (silent-failure patterns), and a game-log self-check. ' +
      'Datapack/version default to the .dpkit.json config or $DPKIT_DATAPACK / $DPKIT_VERSION.',
    inputSchema: {
      datapack: z.string().optional().describe('Datapack path. Defaults to config / $DPKIT_DATAPACK / auto-detect.'),
      version: z.string().optional().describe('Game version to check as. Defaults to config / $DPKIT_VERSION.'),
      files: z.string().optional().describe('data/-relative glob, e.g. test/function/*.mcfunction.'),
      engine: z.enum(['inproc', 'lsp', 'pool']).optional().describe('Engine: pooled in-process (default) / one-shot in-process / legacy LSP subprocess.'),
      noIgnore: z.boolean().optional().describe('Skip filtering the known LastHurtMob false positive.'),
      noGotchas: z.boolean().optional().describe('Skip the known-gotcha heuristic scan.'),
      noMacro: z.boolean().optional().describe('Skip the $ macro-line registry-ID check.'),
      noEntityNbt: z.boolean().optional().describe('Skip the entity-NBT schema check (summon/data field names + registry IDs).'),
      noLog: z.boolean().optional().describe('Skip the game-log self-check.'),
      rules: z.array(z.string()).optional().describe('Project-consistency rules to enable (default: none).'),
      suggestions: z.boolean().optional().describe('Allow suggestion output (default false).'),
    },
  }, async (args) => {
    try {
      const version = ver(args.version);
      const r = await api.checkDatapack({
        datapack: args.datapack ?? defaultDatapack(version),
        version,
        only: args.files,
        engine: pickEngine(args.engine),
        ignore: { useIgnore: !args.noIgnore, extra: [] },
        noGotchas: args.noGotchas,
        noMacro: args.noMacro,
        noEntityNbt: args.noEntityNbt,
        noLog: args.noLog,
        rules: args.rules,
        suggestions: args.suggestions,
        minecraftRoot: cfg.minecraftRoot,
      });
      const report = r.report;
      const issues = truncate(report.issues, 200, 're-run with files= to narrow the check');
      const ignored = truncate(report.ignored, 200);
      const gotchas = truncate(report.gotchas, 100);
      return jsonResult(ok({
        ...report,
        count: issues.total,
        issues: issues.items,
        issuesTotal: issues.total,
        issuesTruncated: issues.truncated,
        ...(issues.hint ? { issuesHint: issues.hint } : {}),
        ignored: ignored.items,
        ignoredTotal: ignored.total,
        ignoredTruncated: ignored.truncated,
        gotchas: gotchas.items,
        gotchasTotal: gotchas.total,
        gotchasTruncated: gotchas.truncated,
      }));
    } catch (e) {
      return errResult(e);
    }
  });

  server.registerTool('check_command', {
    description:
      'Validate one complete Minecraft command string against a game version (uses the same in-process Spyglass parser as the CLI, no temp files). ' +
      'Returns valid/verification/errors/warnings/suggestions. When the version data is incomplete, verification is partial/none and suggestions are hidden.',
    inputSchema: {
      command: z.string().describe('The full command to validate, e.g. "damage @s 5 battle:true_dmg".'),
      version: z.string().optional().describe('Game version. Defaults to config / $DPKIT_VERSION.'),
      datapack: z.string().optional().describe('Optional datapack context (namespace/tags/declared registries). Defaults to config / cwd.'),
      suggestions: z.boolean().optional().describe('Allow suggestion output (default false).'),
    },
  }, async (args) => {
    try {
      const version = ver(args.version);
      const r = await api.checkCommand({
        command: args.command,
        version,
        datapack: (args.datapack ?? defaultDatapack(version)) || undefined,
        suggestions: args.suggestions,
      });
      return jsonResult(ok(r));
    } catch (e) {
      return errResult(e);
    }
  });

  server.registerTool('check_macro', {
    description:
      'Expand `$` macro lines in a function and validate each expanded command with the full command checker. ' +
      'Pass macro_args to fully expand; without args, lines are marked unverified (never errors).',
    inputSchema: {
      macro: z.string().describe('Namespaced function id, e.g. battle:archer/pierce_summon.'),
      version: z.string().optional().describe('Game version. Defaults to config / $DPKIT_VERSION.'),
      datapack: z.string().optional().describe('Datapack path. Defaults to config / $DPKIT_DATAPACK / auto-detect.'),
      macro_args: z.record(z.string(), z.unknown()).optional().describe('Macro variable values as a JSON object.'),
      suggestions: z.boolean().optional().describe('Allow suggestion output (default false).'),
    },
  }, async (args) => {
    try {
      const version = ver(args.version);
      const r = await api.checkMacro({
        macro: args.macro,
        version,
        datapack: args.datapack ?? defaultDatapack(version),
        macroArgs: args.macro_args,
        suggestions: args.suggestions,
      });
      return jsonResult(ok(r));
    } catch (e) {
      return errResult(e);
    }
  });

  server.registerTool('lint_rules', {
    description:
      'Run project-consistency lint rules over a datapack. Rules are off by default; pass rules= to enable, e.g. ["cleanup-id-coverage","on-eat-completeness"]. ' +
      'Returns warnings with evidence + confidence, never unqualified suggestions.',
    inputSchema: {
      datapack: z.string().optional().describe('Datapack path. Defaults to config / $DPKIT_DATAPACK / auto-detect.'),
      rules: z.array(z.string()).optional().describe('Rule names to enable. Empty = no rules.'),
      suggestions: z.boolean().optional().describe('Allow suggestion output (default false).'),
    },
  }, async (args) => {
    try {
      const version = ver();
      const datapack = args.datapack ?? defaultDatapack(version);
      const r = api.runRules(datapack, { rules: args.rules ?? [], suggestions: args.suggestions });
      const t = truncate(r.items, 200, 'narrow the datapack or rules to reduce the result set');
      return jsonResult(ok({
        ...r,
        items: t.items,
        total: t.total,
        truncated: t.truncated,
      }));
    } catch (e) {
      return errResult(e);
    }
  });

  server.registerTool('write_report', {
    description:
      'Write a dpkit JSON report to disk (default dpkit_pvp_report.json). Reads the previous report and returns diff_from_last.',
    inputSchema: {
      report: z.unknown().describe('The CheckReport JSON object to persist.'),
      path: z.string().optional().describe('Output path (default dpkit_pvp_report.json).'),
    },
  }, async (args) => {
    try {
      const path = args.path ?? 'dpkit_pvp_report.json';
      const r = api.writeReport(args.report as Parameters<typeof api.writeReport>[0], path);
      return jsonResult(ok(r));
    } catch (e) {
      return errResult(e);
    }
  });

  server.registerTool('diff_reports', {
    description:
      'Compare two dpkit report JSON objects and return files_added/files_removed/new_errors/fixed_errors. Returns null when old is missing.',
    inputSchema: {
      old: z.unknown().nullable().describe('Previous report JSON (or null).'),
      current: z.unknown().describe('Current report JSON.'),
    },
  }, async (args) => {
    try {
      const r = api.diffReports(args.old as Parameters<typeof api.diffReports>[0], args.current as Parameters<typeof api.diffReports>[1]);
      return jsonResult(ok({ diff: r }));
    } catch (e) {
      return errResult(e);
    }
  });

  server.registerTool('query_syntax', {
    description:
      'Return the exact per-version command grammar for a command path (offline, from the cached Spyglass command tree). ' +
      'Use this before writing or fixing any command — never guess a subcommand or enum for the target version.',
    inputSchema: {
      path: z.string().describe('Command path, e.g. "execute on" or "damage".'),
      version: z.string().optional().describe('Game version. Defaults to config / $DPKIT_VERSION.'),
      depth: z.number().int().min(0).max(8).optional().describe('Expansion depth. Default 4.'),
    },
  }, async (args) => {
    try {
      const version = await ensureVersionData(ver(args.version), ['commands']);
      const r = api.querySyntax(args.path, version, args.depth ?? 4);
      const t = truncate(r.lines, 300, 're-run with a larger depth= to expand deeper');
      return jsonResult(ok({
        path: r.path,
        version: r.version,
        found: r.found,
        lines: t.items,
        count: t.total,
        total: t.total,
        truncated: t.truncated,
        ...(t.hint ? { hint: t.hint } : {}),
      }));
    } catch (e) {
      return errResult(e);
    }
  });

  server.registerTool('complete_at', {
    description:
      'Live completions at a cursor position in a datapack file (data/-relative path, 1-based line and column). ' +
      'Useful to see what a parser accepts right at a spot. $ macro lines yield nothing.',
    inputSchema: {
      file: z.string().describe('data/-relative path, e.g. test/function/x.mcfunction.'),
      line: z.number().int().min(1).describe('1-based line.'),
      column: z.number().int().min(1).describe('1-based column.'),
      datapack: z.string().optional().describe('Datapack path. Defaults to config / $DPKIT_DATAPACK / auto-detect.'),
      version: z.string().optional().describe('Game version. Defaults to config / $DPKIT_VERSION.'),
      engine: z.enum(['inproc', 'lsp', 'pool']).optional().describe('Engine. Default pooled in-process.'),
    },
  }, async (args) => {
    try {
      const version = ver(args.version);
      const items = await api.completeAt({
        datapack: args.datapack ?? defaultDatapack(version),
        version,
        rel: args.file,
        line: args.line,
        column: args.column,
        engine: pickEngine(args.engine),
      });
      const t = truncate(items, 200, 'narrow the cursor position or file to reduce the result set');
      return jsonResult(ok({
        file: args.file,
        line: args.line,
        column: args.column,
        version,
        count: items.length,
        items: t.items,
        total: t.total,
        truncated: t.truncated,
        ...(t.hint ? { hint: t.hint } : {}),
      }));
    } catch (e) {
      return errResult(e);
    }
  });

  server.registerTool('list_registry', {
    description:
      'List the values of a registry for a game version (offline, from the cached Spyglass registry data). ' +
      'Use to check whether an ID like minecraft:knockback exists in the target version before writing it, ' +
      'especially inside $ macro lines where the engine does not validate registry IDs. Unknown registry → the ' +
      'full registry index with counts. Pass search= to filter a large registry (item has 1000+ entries) before ' +
      'the list is truncated.',
    inputSchema: {
      registry: z.string().describe('Registry name, e.g. mob_effect, attribute, damage_type (namespaced form also accepted).'),
      version: z.string().optional().describe('Game version. Defaults to config / $DPKIT_VERSION.'),
      search: z.string().optional().describe('Case-insensitive substring filter applied to the FULL registry before truncation.'),
    },
  }, async (args) => {
    try {
      const version = await ensureVersionData(ver(args.version), ['registries']);
      const r = api.queryRegistry(args.registry, version);
      if (!r.found) {
        return jsonResult(ok(r));
      }
      const search = args.search?.trim().toLowerCase();
      const full = r.values ?? [];
      const filtered = search ? full.filter(v => v.toLowerCase().includes(search)) : full;
      const t = truncate(filtered, 200, 'pass search= to filter the full registry before truncation');
      return jsonResult(ok({
        name: r.name,
        version: r.version,
        found: r.found,
        cached: r.cached,
        values: t.items,
        count: full.length,
        total: t.total,
        truncated: t.truncated,
        ...(t.hint ? { hint: t.hint } : {}),
      }));
    } catch (e) {
      return errResult(e);
    }
  });

  server.registerTool('list_versions', {
    description:
      'List available Minecraft versions, the latest release/snapshot, whether a newer release exists than the configured one, ' +
      'and which versions have command data cached locally.',
    inputSchema: {
      configured: z.string().optional().describe('The version you currently check against. Defaults to config / $DPKIT_VERSION.'),
    },
  }, async (args) => {
    try {
      const v = await api.listVersions(ver(args.configured));
      return jsonResult(ok(v));
    } catch (e) {
      return errResult(e);
    }
  });

  server.registerTool('scan_gotchas', {
    description:
      'Scan a datapack for known silent-failure patterns (damage nesting, particle map syntax, summon NBT casing, ' +
      'advancement criteria+OR). Pure file scan — no engine, no diagnostics. Version only labels the messages.',
    inputSchema: {
      datapack: z.string().optional().describe('Datapack path. Defaults to config / $DPKIT_DATAPACK / auto-detect.'),
      files: z.string().optional().describe('data/-relative glob filter.'),
      version: z.string().optional().describe('Version to label messages with. Defaults to config / $DPKIT_VERSION.'),
    },
  }, async (args) => {
    try {
      const version = ver(args.version);
      const datapack = args.datapack ?? defaultDatapack(version);
      const gotchas = api.scanGotchasStandalone(datapack, args.files ?? '', version);
      const t = truncate(gotchas, 100, 'pass files= to narrow the scan');
      return jsonResult(ok({
        datapack,
        version,
        count: gotchas.length,
        gotchas: t.items,
        total: t.total,
        truncated: t.truncated,
        ...(t.hint ? { hint: t.hint } : {}),
      }));
    } catch (e) {
      return errResult(e);
    }
  });

  server.registerTool('read_logs', {
    description:
      'Diagnose runtime problems: auto-detect the official / Prism / TLauncher launcher latest.log (including rotated ' +
      '.log.gz logs) and return the tail content. Point minecraftRoot= at a Minecraft install base dir to override the ' +
      'default launcher location (defaults to the config minecraftRoot).',
    inputSchema: {
      launcher: z.enum(['default', 'prism', 'tlauncher']).optional().describe('Launcher to read from. Omit to auto-detect (prism → default → tlauncher).'),
      instance: z.string().optional().describe('Prism instance name (only meaningful with Prism Launcher).'),
      lines: z.number().int().min(1).max(1000).optional().describe('Lines per file. Default 100.'),
      tail: z.boolean().optional().describe('Return the last N lines (default true) or the first N (false).'),
      minecraftRoot: z.string().optional().describe('Override base dir; defaults to config minecraftRoot.'),
    },
  }, async (args) => {
    try {
      const r = readGameLogs({
        launcher: args.launcher,
        instance: args.instance,
        lines: args.lines,
        tail: args.tail,
        minecraftRoot: args.minecraftRoot ?? cfg.minecraftRoot,
      });
      return jsonResult(ok(r));
    } catch (e) {
      return errResult(e);
    }
  });

  server.registerTool('get_block_states', {
    description:
      'List block ids, or query a single block\'s state properties/defaults, for a game version (offline, from the cached ' +
      'Spyglass block_states data). Omit block= to list all block ids (truncated with a total); pass block= (bare or ' +
      'minecraft:-prefixed) to get { properties, defaults }.',
    inputSchema: {
      version: z.string().optional().describe('Game version. Defaults to config / $DPKIT_VERSION.'),
      block: z.string().optional().describe('Block id (bare or minecraft:-prefixed). Omit to list all block ids.'),
    },
  }, async (args) => {
    const requested = ver(args.version);
    try {
      const version = await ensureBlockStates(requested);
      if (!args.block) {
        const blocks = listBlockStates(version);
        const t = truncate(blocks, 200, 'pass block= to query a single block');
        return jsonResult({
          ok: true,
          version,
          blocks: t.items,
          count: blocks.length,
          total: t.total,
          truncated: t.truncated,
          ...(t.hint ? { hint: t.hint } : {}),
        });
      }
      const entry = getBlockStates(version, args.block);
      if (!entry) {
        return jsonResult({
          ok: false,
          version,
          block: args.block,
          found: false,
          error: `Unknown block "${args.block}" in version ${version}. Omit block= to list all blocks.`,
        });
      }
      const id = args.block.startsWith('minecraft:') ? args.block.slice('minecraft:'.length) : args.block;
      return jsonResult({
        ok: true,
        version,
        block: id,
        found: true,
        properties: entry.properties,
        defaults: entry.defaults,
      });
    } catch (e) {
      if (e instanceof CommandDataNotCachedError) {
        return jsonResult({ ok: false, version: requested, error: e.message });
      }
      return errResult(e);
    }
  });

  server.registerTool('get_vanilla_data', {
    description:
      'Query Misode\'s mcmeta summary data (the vanilla game\'s own data files) for a game version, cached in the same offline ' +
      'cache. category is one of: ' + VANILLA_CATEGORIES.join(', ') + '. Pass path= to return a single vanilla file\'s JSON ' +
      '(untruncated); otherwise pass search= to filter file keys (the key list is truncated with a total).',
    inputSchema: {
      version: z.string().describe('Game version, e.g. "1.21.4", "26.2", or "latest release".'),
      category: z.string().describe('Vanilla data category (see tool description for the full list).'),
      path: z.string().optional().describe('Fetch one vanilla file by key (e.g. "chests/ancient_city" for loot_table); full JSON, not truncated.'),
      search: z.string().optional().describe('Case-insensitive substring filter over file keys (used when path is omitted).'),
    },
  }, async (args) => {
    try {
      const ensure = await ensureVanillaData(args.version, args.category);
      if (!ensure.ok) {
        return jsonResult(ensure);
      }
      const version = ensure.version;
      if (args.path !== undefined && args.path !== '') {
        const r = getVanillaFile(version, ensure.category, args.path);
        return jsonResult(r);
      }
      const r = searchVanillaFiles(version, ensure.category, args.search ?? '');
      if (!r.ok) return jsonResult(r);
      const t = truncate(r.matches, 200, 'pass search= to filter, or path= to fetch a single file');
      return jsonResult({
        ...r,
        matches: t.items,
        total: t.total,
        truncated: t.truncated,
        ...(t.hint ? { hint: t.hint } : {}),
      });
    } catch (e) {
      return errResult(e);
    }
  });

  // prompts/list — a version-first workflow prompt (see src/prompt-workflow.ts).
  registerWorkflowPrompt(server);

  const transport = new StdioServerTransport();
  try {
    await server.connect(transport);
  } finally {
    await pooledEngine.close();
  }
}

// Entry point for `npm run mcp` / `node dist/mcp.js`.
main().catch(err => {
  console.error(`[mcp] fatal: ${err instanceof Error ? (err.stack ?? err.message) : err}`);
  process.exit(1);
});
