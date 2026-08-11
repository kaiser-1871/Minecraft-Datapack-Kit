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
  verbose?: boolean;
  onLog?: (msg: string) => void;
}

export interface CheckEngine {
  check(opts: EngineCheckOptions): Promise<EngineCheckResult>;
  complete(opts: EngineCompleteOptions): Promise<CompletionItemDTO[]>;
  close(): Promise<void>;
}
