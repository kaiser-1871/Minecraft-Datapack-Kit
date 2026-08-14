#!/usr/bin/env node
// dpkit-mcp.mjs — thin shim over the built MCP server (for the published npm package).
// The real entry is src/mcp.ts -> dist/mcp.js. Usage:
//   npx dpkit-mcp      # stdio MCP server (same as "npm run mcp" in the repo)
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const distMcp = join(dirname(fileURLToPath(import.meta.url)), 'dist', 'mcp.js');
if (!existsSync(distMcp)) {
  console.error('[dpkit-mcp] dist/mcp.js not found — build first:  npm run build');
  process.exit(2);
}
// import() needs a file:// URL on Windows (a bare drive path would be read as a scheme).
const { main } = await import(pathToFileURL(distMcp).href);
await main();
