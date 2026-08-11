// mcp.ts — an MCP (Model Context Protocol) stdio server exposing dpkit's capabilities
// as tools, so AI IDEs (Claude Code, Cursor, …) can call the real Spyglass/DHP engine
// instead of guessing per-version syntax. Each tool call boots a fresh engine (v1); a
// long-lived pooled project is a possible v2 optimization.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as api from './api.js';
import { detectDefaultDatapack } from './datapack-discovery.js';

function defaultDatapack(version: string): string {
  return process.env.DPKIT_DATAPACK ?? detectDefaultDatapack(version);
}

const errorText = (e: unknown): { content: { type: 'text'; text: string }[]; isError: true } => ({
  content: [{ type: 'text', text: JSON.stringify({ error: e instanceof Error ? e.message : String(e) }) }],
  isError: true,
});

export async function main(): Promise<void> {
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
      'ignores (LastHurtMob), 26.2 known-gotcha hints (silent-failure patterns), and a game-log self-check. Defaults to the pvp datapack.',
    inputSchema: {
      datapack: z.string().optional().describe('Datapack path. Defaults to the auto-detected pvp pack or $DPKIT_DATAPACK.'),
      version: z.string().optional().describe('Game version to check as. Default "26.2".'),
      files: z.string().optional().describe('data/-relative glob, e.g. battle/function/snowman/*.mcfunction.'),
      engine: z.enum(['inproc', 'lsp']).optional().describe('Engine: in-process (default) or legacy LSP subprocess.'),
      noIgnore: z.boolean().optional().describe('Skip filtering the known LastHurtMob false positive.'),
      noGotchas: z.boolean().optional().describe('Skip the 26.2 known-gotcha heuristic scan.'),
      noLog: z.boolean().optional().describe('Skip the game-log self-check.'),
    },
  }, async (args) => {
    try {
      const version = args.version ?? '26.2';
      const r = await api.checkDatapack({
        datapack: args.datapack ?? defaultDatapack(version),
        version,
        only: args.files,
        engine: args.engine,
        ignore: { useIgnore: !args.noIgnore, extra: [] },
        noGotchas: args.noGotchas,
        noLog: args.noLog,
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
      version: z.string().optional().describe('Game version. Default "26.2".'),
      depth: z.number().int().min(0).max(8).optional().describe('Expansion depth. Default 4.'),
    },
  }, async (args) => {
    try {
      const r = api.querySyntax(args.path, args.version ?? '26.2', args.depth ?? 4);
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
      file: z.string().describe('data/-relative path, e.g. battle/function/snowman/x.mcfunction.'),
      line: z.number().int().min(1).describe('1-based line.'),
      column: z.number().int().min(1).describe('1-based column.'),
      datapack: z.string().optional().describe('Datapack path. Defaults to the auto-detected pvp pack or $DPKIT_DATAPACK.'),
      version: z.string().optional().describe('Game version. Default "26.2".'),
      engine: z.enum(['inproc', 'lsp']).optional().describe('Engine. Default in-process.'),
    },
  }, async (args) => {
    try {
      const version = args.version ?? '26.2';
      const items = await api.completeAt({
        datapack: args.datapack ?? defaultDatapack(version),
        version,
        rel: args.file,
        line: args.line,
        column: args.column,
        engine: args.engine,
      });
      return { content: [{ type: 'text', text: JSON.stringify({ file: args.file, line: args.line, column: args.column, version, count: items.length, items }, null, 2) }] };
    } catch (e) {
      return errorText(e);
    }
  });

  server.registerTool('list_versions', {
    description:
      'List available Minecraft versions, the latest release/snapshot, whether a newer release exists than the configured one, ' +
      'and which versions have command data cached locally.',
    inputSchema: {
      configured: z.string().optional().describe('The version you currently check against. Default "26.2".'),
    },
  }, async (args) => {
    try {
      const v = await api.listVersions(args.configured ?? '26.2');
      return { content: [{ type: 'text', text: JSON.stringify(v, null, 2) }] };
    } catch (e) {
      return errorText(e);
    }
  });

  server.registerTool('scan_gotchas', {
    description:
      'Scan a datapack for known 26.2 silent-failure patterns (damage nesting, particle map syntax, summon NBT casing, ' +
      'advancement criteria+OR). Pure file scan — no engine, no diagnostics.',
    inputSchema: {
      datapack: z.string().optional().describe('Datapack path. Defaults to the auto-detected pvp pack or $DPKIT_DATAPACK.'),
      files: z.string().optional().describe('data/-relative glob filter.'),
    },
  }, async (args) => {
    try {
      const datapack = args.datapack ?? defaultDatapack('26.2');
      const gotchas = api.scanGotchasStandalone(datapack, args.files ?? '');
      return { content: [{ type: 'text', text: JSON.stringify({ datapack, count: gotchas.length, gotchas }, null, 2) }] };
    } catch (e) {
      return errorText(e);
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Entry point for `npm run mcp` / `node dist/mcp.js`.
main().catch(err => {
  console.error(`[mcp] fatal: ${err instanceof Error ? (err.stack ?? err.message) : err}`);
  process.exit(1);
});
