// init.ts — `dpkit init`: scaffold a .dpkit.json (and an optional GitHub Actions CI
// workflow) so a datapack project is checkable out of the box.
//
// The scaffold is intentionally small and strict-schema compatible: .dpkit.json rejects
// unknown keys, so we only write fields dpkit actually understands.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const CI_WORKFLOW = `name: dpkit

on:
  push:
  pull_request:

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Check datapack
        run: npx --yes dpkit-mc check --datapack=. --version=auto --no-log
`;

const HELP = `dpkit init — scaffold a dpkit project

Usage:
  dpkit init [dir] [options]

Options:
  --dir=<path>     Target directory (default: current directory)
  --version=<v>    Version to pin in .dpkit.json (default: auto)
  --datapack=<p>   Datapack path to write (default: "." when the target contains
                   pack.mcmeta, otherwise a placeholder)
  --no-ci          Skip the .github/workflows/dpkit.yml scaffold
  --force          Overwrite existing .dpkit.json / workflow files
  --help, -h       Show this help
`;

export interface InitOptions {
  dir: string;
  version: string;
  datapack?: string;
  ci: boolean;
  force: boolean;
}

export async function initCommand(args: string[]): Promise<void> {
  const opts = parseInitArgs(args);
  if (opts === 'help') {
    console.log(HELP);
    return;
  }

  mkdirSync(opts.dir, { recursive: true });
  const hasPack = existsSync(join(opts.dir, 'pack.mcmeta'));
  const datapack = opts.datapack ?? (hasPack ? '.' : 'path/to/your/datapack');
  const config = {
    datapack,
    version: opts.version,
  };

  const configPath = join(opts.dir, '.dpkit.json');
  if (existsSync(configPath) && !opts.force) {
    throw new Error(`${configPath} already exists (use --force to overwrite)`);
  }
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  console.log(`[init] wrote ${configPath}`);

  if (opts.ci) {
    const workflowPath = join(opts.dir, '.github', 'workflows', 'dpkit.yml');
    if (existsSync(workflowPath) && !opts.force) {
      console.log(`[init] skipped existing ${workflowPath} (use --force to overwrite)`);
    } else {
      mkdirSync(join(opts.dir, '.github', 'workflows'), { recursive: true });
      writeFileSync(workflowPath, CI_WORKFLOW);
      console.log(`[init] wrote ${workflowPath}`);
    }
  }
}

function parseInitArgs(args: string[]): InitOptions | 'help' {
  let dir = process.cwd();
  let version = 'auto';
  let datapack: string | undefined;
  let ci = true;
  let force = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--help' || a === '-h') return 'help';
    if (a === '--force') { force = true; continue; }
    if (a === '--no-ci') { ci = false; continue; }
    if (a.startsWith('--dir=')) { dir = resolve(process.cwd(), a.slice('--dir='.length)); continue; }
    if (a === '--dir') {
      i++;
      if (i >= args.length) throw new Error('--dir needs a value');
      dir = resolve(process.cwd(), args[i]);
      continue;
    }
    if (a.startsWith('--version=')) { version = a.slice('--version='.length); continue; }
    if (a === '--version') {
      i++;
      if (i >= args.length) throw new Error('--version needs a value');
      version = args[i];
      continue;
    }
    if (a.startsWith('--datapack=')) { datapack = a.slice('--datapack='.length); continue; }
    if (a === '--datapack') {
      i++;
      if (i >= args.length) throw new Error('--datapack needs a value');
      datapack = args[i];
      continue;
    }
    if (a.startsWith('-')) throw new Error(`unknown init option: ${a}`);
    dir = resolve(process.cwd(), a);
  }

  return { dir, version, datapack, ci, force };
}
