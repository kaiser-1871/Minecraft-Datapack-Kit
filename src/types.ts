// types.ts — shared types for the dpkit API, CLI, engines, and MCP server.

export interface Pos {
  line: number;
  character: number;
}

export interface IssueRange {
  start: Pos;
  end: Pos;
}

/**
 * A diagnostic in LSP numbering (severity: 1=Error, 2=Warning, 3=Info, 4=Hint).
 * Both engines normalize to this at their boundary so downstream code (report text,
 * issue signatures) never needs to know where the diagnostic came from.
 */
export interface RawDiagnostic {
  severity?: number;
  message: string;
  range: IssueRange;
}

export interface ReportIssue {
  file: string;
  line: number;
  char: number;
  severity: string; // 'E' | 'W' | '·'
  message: string;
}

export interface GotchaIssue {
  line: number;
  key: string;
  msg: string;
}

export interface GameLogReport {
  found: boolean;
  log?: string;
  stale?: boolean;
  lastLoaded?: string | null;
  hits?: string[];
}

/** The serialized `log` field of a CheckReport (matches the legacy --json shape). */
export type CheckLog = { found: false } | { found: true; path: string; stale: boolean; lastLoaded: string | null; errors: string[] };

export interface BaselineEntry {
  sig: string;
}

export interface SyntaxResult {
  path: string;
  version: string;
  found: boolean;
  lines: string[];
}

export interface CompletionItemDTO {
  label: string;
  kind: string | null;
  detail: string | null;
  documentation: string | null;
}
