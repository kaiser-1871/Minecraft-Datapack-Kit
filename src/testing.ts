// testing.ts — test helpers for datapack authors.
//
// Inspired by Beet's pytest-first integration: a checker becomes much more useful when it is
// callable from a test suite as an assertion, not just as a CI command. These helpers wrap the
// typed API for Node's built-in test runner (or any assertion library).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { checkDatapack } from './api.js';
import type { CheckOptions, CheckReport } from './api.js';

export interface TestCheckOptions extends Partial<CheckOptions> {
  datapack: string;
  version?: string;
}

export interface SnapshotCheckOptions extends TestCheckOptions {
  /** Snapshot file to compare/write. Defaults to `.dpkit-snapshot.json` in cwd. */
  snapshotFile?: string;
  /** Write/update the snapshot instead of comparing. Defaults to DPKIT_UPDATE_SNAPSHOTS=1. */
  update?: boolean;
}

/** Run a full dpkit check and return the serializable report. */
export async function checkDatapackForTest(opts: TestCheckOptions): Promise<CheckReport> {
  const full: CheckOptions = {
    version: 'auto',
    ...opts,
  };
  return (await checkDatapack(full)).report;
}

/** Render the report's issues as a compact text block (for assertion failure messages). */
export function formatReport(report: CheckReport): string {
  if (report.issues.length === 0) return 'no issues';
  return report.issues
    .map(i => `${i.file}:${i.line}:${i.char} [${i.severity}] ${i.message}`)
    .join('\n');
}

/**
 * Assert that a datapack has no errors or internal failures (warnings do not fail, matching
 * the CLI's default). Throws with a formatted report when the check fails.
 */
export async function assertDatapackClean(
  opts: TestCheckOptions | string,
  message = 'dpkit found errors',
): Promise<CheckReport> {
  const report = await checkDatapackForTest(typeof opts === 'string' ? { datapack: opts } : opts);
  const failed = report.summary.errors > 0 || report.summary.internalFailures > 0;
  if (failed) {
    throw new Error(
      `${message}\n` +
      `errors=${report.summary.errors} internalFailures=${report.summary.internalFailures} warnings=${report.summary.warnings}\n` +
      formatReport(report),
    );
  }
  return report;
}

/**
 * Snapshot assertion: compare the stable parts of a report (resolved version, issues, summary)
 * against a JSON snapshot file. Set `update: true` or DPKIT_UPDATE_SNAPSHOTS=1 to write it.
 * This gives datapack authors golden-test coverage when upgrading Minecraft versions.
 */
export async function assertDatapackSnapshot(opts: SnapshotCheckOptions): Promise<CheckReport> {
  const report = await checkDatapackForTest(opts);
  const snapshotFile = opts.snapshotFile ?? join(process.cwd(), '.dpkit-snapshot.json');
  const normalized = {
    version: report.resolvedVersion,
    summary: report.summary,
    issues: report.issues,
  };
  const text = JSON.stringify(normalized, null, 2) + '\n';

  const update = opts.update ?? process.env.DPKIT_UPDATE_SNAPSHOTS === '1';
  if (update) {
    mkdirSync(dirname(snapshotFile), { recursive: true });
    writeFileSync(snapshotFile, text);
    return report;
  }

  if (!existsSync(snapshotFile)) {
    throw new Error(
      `snapshot not found: ${snapshotFile}\n` +
      `run with DPKIT_UPDATE_SNAPSHOTS=1 (or update: true) to create it`,
    );
  }

  let expected: unknown;
  try {
    expected = JSON.parse(readFileSync(snapshotFile, 'utf8'));
  } catch (err) {
    throw new Error(`snapshot ${snapshotFile} is not valid JSON: ${(err as Error).message}`);
  }
  if (JSON.stringify(expected) !== JSON.stringify(normalized)) {
    throw new Error(
      `snapshot mismatch for ${snapshotFile}\n` +
      `--- expected ---\n${JSON.stringify(expected, null, 2)}\n` +
      `--- actual ---\n${JSON.stringify(normalized, null, 2)}`,
    );
  }
  return report;
}
