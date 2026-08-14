// engine/types.ts — the engine abstraction both the in-process and LSP drivers implement.
import type { CompletionItemDTO, RawDiagnostic } from '../types.js';

export interface EngineCheckResult {
  resolvedVersion: string | null;
  /** Diagnostics keyed by data/-relative path, severity already mapped to LSP numbering. */
  diagnosticsByRel: Map<string, RawDiagnostic[]>;
  /** Rels whose file the server could not check (no diagnostics emitted). */
  failedRels: Set<string>;
}

export interface EngineCheckOptions {
  datapack: string;
  version: string;
  /** Absolute paths of the dpkit file set (data/**\/*.mcfunction + *.json). */
  files: string[];
  /** data/-relative paths, parallel to `files`. */
  rels: string[];
  mode: 'open' | 'analyze';
  /** Disable the gotcha linter rules in the engine config (mirrors --no-gotchas). */
  noGotchas?: boolean;
  verbose?: boolean;
  onLog?: (msg: string) => void;
}

export interface EngineCompleteOptions {
  datapack: string;
  version: string;
  file: string; // absolute path
  rel: string; // data/-relative path
  line: number; // 1-based
  column: number; // 1-based
  /** Inline document text to complete instead of reading `file` from disk (file may not exist). */
  text?: string;
  verbose?: boolean;
  onLog?: (msg: string) => void;
}

/** A snapshot of the engine's current per-file diagnostics (for incremental watch re-renders). */
export interface EngineSnapshot {
  diagnosticsByRel: Map<string, RawDiagnostic[]>;
  resolvedVersion: string | null;
}

export interface CheckEngine {
  check(opts: EngineCheckOptions): Promise<EngineCheckResult>;
  complete(opts: EngineCompleteOptions): Promise<CompletionItemDTO[]>;
  close(): Promise<void>;
  /** Optional incremental update: re-parse/bind/check ONE file in place (no full analysis). */
  updateFile?(opts: { rel: string; file: string; text: string }): Promise<void>;
  /** Optional: the diagnostics map the engine currently holds (after check/updateFile calls). */
  snapshot?(): EngineSnapshot;
}
