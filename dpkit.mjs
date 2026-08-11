#!/usr/bin/env node
// dpkit.mjs — thin shim over the built TypeScript CLI.
// The real entry is src/cli.ts → dist/cli.js. Keep this invocation working:
//   node dpkit.mjs [options]
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const distCli = join(dirname(fileURLToPath(import.meta.url)), 'dist', 'cli.js');
if (!existsSync(distCli)) {
  console.error('[dpkit] dist/cli.js not found — build first:  npm run build');
  process.exit(2);
}
// import() needs a file:// URL on Windows (a bare drive path would be read as a scheme).
const { main } = await import(pathToFileURL(distCli).href);
await main();
