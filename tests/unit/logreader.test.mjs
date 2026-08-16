// logreader.test.mjs — log locating/reading across launchers (offline, temp dirs only).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, utimesSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import {
  readGameLogs,
  collectLogFiles,
  findPrismLogs,
  readLogFile,
  getDefaultMinecraftDir,
  MAX_LOG_LINES,
} from '../../dist/logreader.js';

test('readGameLogs reads default-launcher logs via minecraftRoot (latest first, gz decompressed)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dpkit-logreader-'));
  const logsDir = join(dir, 'logs');
  mkdirSync(logsDir, { recursive: true });
  writeFileSync(join(logsDir, 'latest.log'), 'line1\nline2\nline3\nline4\nline5\n');
  writeFileSync(join(logsDir, '2024-01-01-1.log'), 'rot1\nrot2\nrot3\n');
  writeFileSync(join(logsDir, '2024-01-02-1.log.gz'), gzipSync(Buffer.from('gz1\ngz2\ngz3\ngz4\n', 'utf8')));
  try {
    const result = readGameLogs({ launcher: 'default', minecraftRoot: dir });
    assert.equal(result.success, true);
    assert.equal(result.launcher, 'default');
    assert.equal(result.logs.length, 3);
    assert.equal(result.logs[0].file, 'latest.log');
    assert.equal(result.logs[0].content, 'line1\nline2\nline3\nline4\nline5');

    const gz = result.logs.find((l) => l.file.endsWith('.log.gz'));
    assert.ok(gz, 'rotated gz log is collected');
    assert.equal(gz.content, 'gz1\ngz2\ngz3\ngz4');

    for (const l of result.logs) {
      assert.equal(typeof l.file, 'string');
      assert.ok(l.path.startsWith(dir), 'path is inside the temp minecraftRoot');
      assert.ok(l.size > 0, 'size is positive');
      assert.equal(typeof l.linesShown, 'number');
      assert.equal(typeof l.content, 'string');
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('tail and head truncation', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dpkit-logreader-'));
  const logsDir = join(dir, 'logs');
  mkdirSync(logsDir, { recursive: true });
  const lines = Array.from({ length: 10 }, (_, i) => `line${i + 1}`);
  writeFileSync(join(logsDir, 'latest.log'), lines.join('\n') + '\n');
  try {
    const tail = readGameLogs({ launcher: 'default', minecraftRoot: dir, lines: 3, tail: true });
    assert.equal(tail.logs[0].content, 'line8\nline9\nline10');
    assert.equal(tail.logs[0].linesShown, 3);

    const head = readGameLogs({ launcher: 'default', minecraftRoot: dir, lines: 3, tail: false });
    assert.equal(head.logs[0].content, 'line1\nline2\nline3');
    assert.equal(head.logs[0].linesShown, 3);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('line count is capped at MAX_LOG_LINES', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dpkit-logreader-'));
  const logsDir = join(dir, 'logs');
  mkdirSync(logsDir, { recursive: true });
  const many = Array.from({ length: MAX_LOG_LINES + 200 }, (_, i) => `L${i}`);
  writeFileSync(join(logsDir, 'latest.log'), many.join('\n') + '\n');
  try {
    const result = readGameLogs({ launcher: 'default', minecraftRoot: dir, lines: 999999, tail: false });
    assert.equal(result.logs[0].linesShown, MAX_LOG_LINES);
    assert.equal(result.logs[0].content.split('\n').length, MAX_LOG_LINES);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('collectLogFiles puts latest.log first then rotated by mtime desc', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dpkit-logreader-'));
  const logsDir = join(dir, 'logs');
  mkdirSync(logsDir, { recursive: true });
  const a = join(logsDir, '2024-01-01-1.log');
  const b = join(logsDir, '2024-01-02-1.log.gz');
  const latest = join(logsDir, 'latest.log');
  writeFileSync(a, 'a\n');
  writeFileSync(b, 'b\n');
  writeFileSync(latest, 'l\n');
  const tB = new Date('2024-01-03T00:00:00Z');
  const tA = new Date('2024-01-01T00:00:00Z');
  const tL = new Date('2023-12-31T00:00:00Z');
  utimesSync(b, tB, tB);
  utimesSync(a, tA, tA);
  utimesSync(latest, tL, tL);
  try {
    const files = collectLogFiles(logsDir);
    assert.deepEqual(
      files.map((f) => basename(f)),
      ['latest.log', '2024-01-02-1.log.gz', '2024-01-01-1.log'],
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('findPrismLogs selects instances (named or all, minecraft/.minecraft)', () => {
  const prism = mkdtempSync(join(tmpdir(), 'dpkit-prism-'));
  const instancesDir = join(prism, 'instances');
  mkdirSync(join(instancesDir, 'a', 'minecraft', 'logs'), { recursive: true });
  mkdirSync(join(instancesDir, 'b', '.minecraft', 'logs'), { recursive: true });
  writeFileSync(join(instancesDir, 'a', 'minecraft', 'logs', 'latest.log'), 'a log\n');
  writeFileSync(join(instancesDir, 'b', '.minecraft', 'logs', 'latest.log'), 'b log\n');
  try {
    const one = findPrismLogs(prism, 'a');
    assert.equal(one.length, 1);
    assert.equal(one[0].instance, 'a');
    assert.equal(basename(one[0].files[0]), 'latest.log');

    const all = findPrismLogs(prism);
    assert.equal(all.length, 2);
    assert.deepEqual(all.map((x) => x.instance).sort(), ['a', 'b']);

    assert.deepEqual(findPrismLogs(prism, 'missing'), []);
    assert.deepEqual(findPrismLogs(join(prism, 'nope')), []);
  } finally {
    rmSync(prism, { recursive: true, force: true });
  }
});

test('readLogFile decompresses gz and skips unreadable/corrupt files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dpkit-logreader-'));
  writeFileSync(join(dir, 'x.log.gz'), gzipSync(Buffer.from('hello\nworld\n', 'utf8')));
  writeFileSync(join(dir, 'bad.log.gz'), 'not-a-gzip');
  try {
    const good = readLogFile(join(dir, 'x.log.gz'), 1, true);
    assert.equal(good.content, 'world');
    assert.equal(good.linesShown, 1);
    assert.equal(readLogFile(join(dir, 'bad.log.gz')), null);
    assert.equal(readLogFile(join(dir, 'missing.log')), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('minecraftRoot overrides the default launcher base dir', () => {
  assert.equal(getDefaultMinecraftDir('/custom/mc'), '/custom/mc');
  assert.equal(typeof getDefaultMinecraftDir(), 'string');
});

test('auto-detect resolves the default launcher when prism/tlauncher are absent', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dpkit-logreader-'));
  mkdirSync(join(dir, 'logs'), { recursive: true });
  writeFileSync(join(dir, 'logs', 'latest.log'), 'autodetect\n');
  const prevAppData = process.env.APPDATA;
  const prevXdg = process.env.XDG_DATA_HOME;
  const appData = mkdtempSync(join(tmpdir(), 'dpkit-appdata-'));
  process.env.APPDATA = appData;
  process.env.XDG_DATA_HOME = appData;
  try {
    const result = readGameLogs({ minecraftRoot: dir });
    assert.equal(result.success, true);
    assert.equal(result.launcher, 'default');
    assert.equal(result.logs[0].content, 'autodetect');
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(appData, { recursive: true, force: true });
    if (prevAppData === undefined) delete process.env.APPDATA; else process.env.APPDATA = prevAppData;
    if (prevXdg === undefined) delete process.env.XDG_DATA_HOME; else process.env.XDG_DATA_HOME = prevXdg;
  }
});

test('not-found reports success:false with probed paths', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dpkit-logreader-empty-'));
  const prevAppData = process.env.APPDATA;
  const prevXdg = process.env.XDG_DATA_HOME;
  const appData = mkdtempSync(join(tmpdir(), 'dpkit-appdata-'));
  process.env.APPDATA = appData;
  process.env.XDG_DATA_HOME = appData;
  try {
    const result = readGameLogs({ minecraftRoot: dir });
    assert.equal(result.success, false);
    assert.equal(result.logs.length, 0);
    assert.equal(typeof result.error, 'string');
    assert.ok(result.error.includes('No Minecraft logs found'));
    assert.ok(result.error.includes(dir), 'error lists the probed minecraftRoot');
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(appData, { recursive: true, force: true });
    if (prevAppData === undefined) delete process.env.APPDATA; else process.env.APPDATA = prevAppData;
    if (prevXdg === undefined) delete process.env.XDG_DATA_HOME; else process.env.XDG_DATA_HOME = prevXdg;
  }
});
