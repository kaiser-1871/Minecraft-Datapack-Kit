// report-store.ts — write/read dpkit JSON reports and compute diff_from_last.
//
// The CLI writes a stable, machine-readable report after each check (default
// dpkit_pvp_report.json) so a stale report cannot be mistaken for the current state. The next
// run reads the old report and reports what changed.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { CheckReport } from './api.js';

export interface ReportDiff {
  files_added: number;
  files_removed: number;
  new_errors: number;
  fixed_errors: number;
}

export const DEFAULT_REPORT_FILE = 'dpkit_pvp_report.json';

/** Read a previously written report, or null when absent/unreadable. */
export function readReport(path: string): CheckReport | null {
  try {
    if (!existsSync(path)) return null;
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as CheckReport;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/** Compute the diff between an old report and the current report. */
export function diffReports(oldReport: CheckReport | null, current: CheckReport): ReportDiff | null {
  if (!oldReport) return null;
  if (!current || typeof current !== 'object') {
    throw new Error('[diff_reports] current report must be a JSON object');
  }
  const oldFiles = new Set(oldReport.issues?.map(i => i.file) ?? []);
  const curFiles = new Set(current.issues?.map(i => i.file) ?? []);
  let filesAdded = 0;
  let filesRemoved = 0;
  for (const f of curFiles) if (!oldFiles.has(f)) filesAdded++;
  for (const f of oldFiles) if (!curFiles.has(f)) filesRemoved++;

  const oldErrKeys = new Set((oldReport.issues ?? []).filter(i => i.severity === 'E').map(i => `${i.file}:${i.line}:${i.message}`));
  const curErrKeys = new Set((current.issues ?? []).filter(i => i.severity === 'E').map(i => `${i.file}:${i.line}:${i.message}`));
  let newErrors = 0;
  let fixedErrors = 0;
  for (const k of curErrKeys) if (!oldErrKeys.has(k)) newErrors++;
  for (const k of oldErrKeys) if (!curErrKeys.has(k)) fixedErrors++;

  return { files_added: filesAdded, files_removed: filesRemoved, new_errors: newErrors, fixed_errors: fixedErrors };
}

/** Write a report file with generated_at and diff_from_last filled in. */
export function writeReport(report: CheckReport, path: string): { path: string; written: boolean; diff_from_last: ReportDiff | null } {
  if (!report || typeof report !== 'object') {
    throw new Error('[write_report] report must be a JSON object');
  }
  const old = readReport(path);
  const diff = diffReports(old, report);
  const data = {
    ...report,
    files: {
      ...report.files,
      total_on_disk: (report.files?.checked ?? 0) + (report.coverage?.unreadableFiles ?? 0),
      data_files_checked: report.coverage?.filesChecked ?? report.files?.checked ?? 0,
      non_data_skipped: report.coverage?.overlayFilesSkipped ?? 0,
    },
    coverage: report.coverage ? {
      ...report.coverage,
      macro_lines_total: report.coverage.macroLines,
      macro_fully_checked: report.coverage.macroLines > 0 ? report.coverage.macroChecked + report.coverage.macroSyntaxChecked : 0,
      macro_syntax_only: report.coverage.macroLines > 0 ? report.coverage.macroUnchecked + report.coverage.macroSyntaxUnchecked : 0,
      nbt_checked: report.coverage.nbtChecked,
      nbt_unchecked: report.coverage.nbtUnchecked,
    } : report.coverage,
    generated_at: new Date().toISOString(),
    diff_from_last: diff,
  };
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
  return { path, written: true, diff_from_last: diff };
}
