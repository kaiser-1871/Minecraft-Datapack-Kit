// mcp.ts — an MCP (Model Context Protocol) stdio server exposing dpkit's capabilities
// as tools, so AI IDEs (Claude Code, Cursor, …) can call the real Spyglass/DHP engine
// instead of guessing per-version syntax. Each tool call boots a fresh engine (v1); a
// long-lived pooled project is a possible v2 optimization.
//
// Defaults follow .dpkit.json (cwd → home, or $DPKIT_CONFIG) so any user can point the
// tools at their own datapack/version. Precedence: per-call arg > $DPKIT_DATAPACK /
// $DPKIT_VERSION > .dpkit.json > built-in default.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as api from './api.js';
import { DEFAULT_VERSION, loadConfig } from './config.js';
import { detectDefaultDatapack } from './datapack-discovery.js';

const errorText = (e: unknown): { content: { type: 'text'; text: string }[]; isError: true } => ({
  content: [{ type: 'text', text: JSON.stringify({ error: e instanceof Error ? e.message : String(e) }) }],
  isError: true,
});

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
      'Check a Minecraft datapack with the Spyglass/DHP engine and return a structured report: diagnostics, known-false-positive ' +
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
        minecraftRoot: cfg.minecraftRoot,
      });
      return { content: [{ type: 'text', text: JSON.stringify(r.report, null, 2) }] };
    } catch (e) {
      return errorText(e);
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
      const r = api.querySyntax(args.path, ver(args.version), args.depth ?? 4);
      return { content: [{ type: 'text', text: JSON.stringify(r, null, 2) }] };
    } catch (e) {
      return errorText(e);
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
      return { content: [{ type: 'text', text: JSON.stringify({ file: args.file, line: args.line, column: args.column, version, count: items.length, items }, null, 2) }] };
    } catch (e) {
      return errorText(e);
    }
  });

  server.registerTool('list_registry', {
    description:
      'List the values of a registry for a game version (offline, from the cached Spyglass registry data). ' +
      'Use to check whether an ID like minecraft:knockback exists in the target version before writing it, ' +
      'especially inside $ macro lines where the engine does not validate registry IDs. Unknown registry → the ' +
      'full registry index with counts.',
    inputSchema: {
      registry: z.string().describe('Registry name, e.g. mob_effect, attribute, damage_type (namespaced form also accepted).'),
      version: z.string().optional().describe('Game version. Defaults to config / $DPKIT_VERSION.'),
    },
  }, async (args) => {
    try {
      const r = api.queryRegistry(args.registry, ver(args.version));
      return { content: [{ type: 'text', text: JSON.stringify(r, null, 2) }] };
    } catch (e) {
      return errorText(e);
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
      return { content: [{ type: 'text', text: JSON.stringify(v, null, 2) }] };
    } catch (e) {
      return errorText(e);
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
      return { content: [{ type: 'text', text: JSON.stringify({ datapack, version, count: gotchas.length, gotchas }, null, 2) }] };
    } catch (e) {
      return errorText(e);
    }
  });

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
