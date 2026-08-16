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
  /** Stable diagnostic code, e.g. 'unknown-item-id' (optional; engine diagnostics may omit). */
  code?: string;
  /** Supporting file references for the diagnostic (optional). */
  evidence?: string[];
  /** Deterministic diagnostics get 1.0; heuristic/rule diagnostics use a lower value. */
  confidence?: number;
  /** Suggested fix, only shown when confidence >= 0.9 and suggestions are enabled. */
  suggestion?: string | null;
  /** Confidence in the suggestion itself (null when no suggestion). */
  suggestion_confidence?: number | null;
}

export interface ReportIssue {
  file: string;
  line: number;
  char: number;
  severity: string; // 'E' | 'W' | '·'
  message: string;
  /** Stable diagnostic code, e.g. 'unknown-item-id'. */
  code?: string;
  /** Supporting file references for the diagnostic. */
  evidence?: string[];
  /** Deterministic diagnostics get 1.0; heuristic/rule diagnostics use a lower value. */
  confidence?: number;
  /** Suggested fix, only present when confidence >= 0.9 and suggestions are enabled. */
  suggestion?: string | null;
  /** Confidence in the suggestion itself (null when no suggestion). */
  suggestion_confidence?: number | null;
}

/** Rule-lint alert (project-level inconsistency, not a syntax error). */
export interface RuleAlert {
  rule: string;
  severity: 'warning' | 'error' | 'suggestion';
  confidence: number;
  message: string;
  evidence: string[];
  suggestion: string | null;
  suggestion_confidence: number | null;
  file?: string;
  line?: number;
  column?: number;
}

/** Result of a rule-lint run. */
export interface RuleReport {
  checked: number;
  alerts: number;
  items: RuleAlert[];
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
