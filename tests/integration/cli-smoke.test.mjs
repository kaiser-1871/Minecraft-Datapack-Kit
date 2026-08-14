// cli-smoke.test.mjs — spawn-level smoke tests for the CLI shell (dpkit.mjs).
// The unit suites cover the modules; this file closes the "CLI shell has no automated
// coverage" gap: argument parsing, exit codes (0/1/4), offline teach modes, datapack
// warning gating, and error paths are exercised through the real entry point.
//
// Env hygiene: every case isolates USERPROFILE/HOME/APPDATA into a fresh temp dir so no
// developer home config or .minecraft leaks in. LOCALAPPDATA is deliberately PRESERVED —
// it holds the Spyglass cache the offline teach modes read from.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url)); // tests/integration/ -> repo root
const CLI = join(ROOT, 'dpkit.mjs');
const FIXTURE = join(ROOT, 'tests', 'fixtures', 'pack');

const tempDirs = [];
after(() => { for (const d of tempDirs) rmSync(d, { recursive: true, force: true }); });

function freshHome() {
  const home = mkdtempSync(join(tmpdir(), 'dpkit-home-'));
  tempDirs.push(home);
  const env = {
    ...process.env,
    USERPROFILE: home,
    HOME: home,
    APPDATA: join(home, 'AppData', 'Roaming'),
    DPKIT_CONFIG: '',
    DPKIT_DATAPACK: '',
    DPKIT_VERSION: '',
  };
  return { home, env };
}

function runCli(args, { env, cwd = ROOT } = {}) {
  const r = spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    env: env ?? { ...process.env, DPKIT_CONFIG: '', DPKIT_DATAPACK: '', DPKIT_VERSION: '' },
    encoding: 'utf8',
    timeout: 120_000,
  });
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

test('--help exits 0 and shows usage', () => {
  const { env } = freshHome();
  const r = runCli(['--help'], { env });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /--datapack/);
  assert.match(r.stdout, /Exit codes: 0/);
});

test('--help exits 0 even with a broken --config', () => {
  const { env } = freshHome();
  const r = runCli(['--help', '--config=Z:/no/such/config.json'], { env });
  assert.equal(r.status, 0);
});

test('--syntax teaches offline and stays quiet about a missing config datapack', () => {
  const { home, env } = freshHome();
  // A home config whose datapack path is missing must NOT warn on offline teach commands.
  writeFileSync(join(home, '.dpkit.json'), JSON.stringify({ datapack: 'Z:/missing/pack' }));
  const r = runCli(['--syntax=execute on'], { env });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /attacker/);
  assert.match(r.stdout, /vehicle/);
  assert.doesNotMatch(r.stderr, /points at a missing datapack/);
});

test('a normal check still warns when the config datapack is missing (exit 4)', () => {
  const { home, env } = freshHome();
  writeFileSync(join(home, '.dpkit.json'), JSON.stringify({ datapack: 'Z:/missing/pack', version: '26.2' }));
  const r = runCli([], { env });
  assert.equal(r.status, 4);
  assert.match(r.stderr, /points at a missing datapack/);
});

test('--registry=? lists all registries and exits 0', () => {
  const { env } = freshHome();
  const r = runCli(['--registry=?'], { env });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /available registries for/);
  assert.match(r.stdout, /entries/);
});

test('--registry=<unknown> still exits 1', () => {
  const { env } = freshHome();
  const r = runCli(['--registry=no_such_registry_xyz'], { env });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /not in version/);
});

test('--syntax with a never-cached version fails cleanly (no stack trace)', () => {
  const { env } = freshHome();
  const r = runCli(['--syntax=execute', '--version=9.99'], { env });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /No command data cached for version 9\.99/);
  assert.doesNotMatch(r.stderr, /internal failure|at file:/);
});

test('--registry=mob_effect exits 0 with values', () => {
  const { env } = freshHome();
  const r = runCli(['--registry=mob_effect'], { env });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /speed/);
});

test('--versions exits 0 and shows the latest release line', () => {
  const { env } = freshHome();
  const r = runCli(['--versions'], { env });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /latest release: /);
});

test('an unrecognized --version warns before falling back', () => {
  const { env } = freshHome();
  const r = runCli(['--datapack=' + FIXTURE, '--version=not-a-version', '--no-log'], { env });
  assert.equal(r.status, 1); // fixture carries known errors, not a regression
  assert.match(r.stderr, /not recognized/);
});

test('a broken pack.mcmeta is reported and exits 1', () => {
  const { home, env } = freshHome();
  const pack = join(home, 'pack');
  cpSync(FIXTURE, pack, { recursive: true });
  writeFileSync(join(pack, 'pack.mcmeta'), 'not json {{');
  const r = runCli(['--datapack=' + pack, '--version=26.2', '--no-log'], { env });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /pack\.mcmeta is not valid JSON/);
});

test('a missing --datapack path exits 4 with a clear message', () => {
  const { env } = freshHome();
  const r = runCli(['--datapack=Z:/definitely/not/here'], { env });
  assert.equal(r.status, 4);
  assert.match(r.stderr, /datapack directory not found/);
});
