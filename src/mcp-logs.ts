// mcp-logs.ts — cursor-based log tail for the MCP read_logs / wait_for_log tools.
//
// Borrowed design from MCP-rogal (https://github.com/rogalKraft/mcp-rogal, CC0-1.0):
// every captured line gets a monotonically increasing id, reads are cursor-based
// (`since_id` / `nextId`), buffer overflow is reported as `missed` instead of silently
// dropping history, and wait_for_log blocks until a pattern appears.
//
// dpkit reads Minecraft's on-disk logs rather than attaching a Log4j appender, so the
// buffer is refreshed by polling readGameLogs(); the cursor/diff logic is otherwise the
// same idea: only lines we have not seen before are appended, and a reader that falls
// behind learns about the gap.

import {
  readGameLogs,
  MAX_LOG_LINES,
  type GameLogsResult,
  type ReadGameLogsOptions,
} from './logreader.js';

/** One line captured from a Minecraft log file. */
export interface McpLogEntry {
  /** Monotonic id; never reused within a server process. */
  id: number;
  /** Epoch ms when this line was first seen by dpkit. */
  ts: number;
  /** Basename of the log file (e.g. latest.log). */
  file: string;
  /** Absolute path of the log file. */
  path: string;
  /** Currently always 'game'; a future in-game bridge could add 'chat'. */
  source: 'game';
  /** The log line text. */
  message: string;
}

export interface McpLogQueryOptions {
  /** Return entries with id >= this. Use nextId from a previous read. */
  sinceId?: number;
  /** Case-insensitive regular expression matched against the message. */
  pattern?: string;
  /** Maximum entries to return (tail semantics: newest N matches). */
  limit?: number;
}

export interface McpLogQueryResult {
  entries: McpLogEntry[];
  nextId: number;
  /** Number of entries evicted before the caller's cursor, when known. */
  missed: number;
  droppedTotal: number;
  buffered: number;
  warning?: string;
}

export interface McpLogWaitResult {
  matched: boolean;
  waitedMs: number;
  timeoutMs: number;
  nextId: number;
  entry?: McpLogEntry;
  context?: McpLogEntry[];
  hint?: string;
}

interface FileTailState {
  /** Last non-empty line we appended from this file; used as an anchor for diffs. */
  lastLine: string | null;
}

function splitLines(text: string): string[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Bounded in-memory tail of Minecraft log lines with cursor-based reads.
 *
 * The buffer is process-wide so `read_logs` and `wait_for_log` share one cursor stream.
 */
export class McpLogTail {
  private readonly capacity: number;
  private entries: McpLogEntry[] = [];
  private nextId = 1;
  private droppedTotal = 0;
  private readonly fileStates = new Map<string, FileTailState>();

  constructor(capacity = 5000) {
    this.capacity = Math.max(1, capacity);
  }

  /** The id the next appended line will receive; a fresh reader can start here to skip history. */
  nextIdValue(): number {
    return this.nextId;
  }

  /**
   * Re-read the configured Minecraft logs and append only lines not seen before.
   * Returns the raw readGameLogs result so callers can keep the legacy `logs` shape too.
   */
  refresh(opts: ReadGameLogsOptions): GameLogsResult {
    // Always read a generous tail internally so the last-seen anchor stays in view; the
    // per-call `lines` argument still controls how many entries are returned by query().
    const result = readGameLogs({ ...opts, lines: MAX_LOG_LINES, tail: true });
    if (!result.success) return result;

    for (const log of result.logs) {
      const lines = splitLines(log.content).filter((line) => line.trim().length > 0);
      if (lines.length === 0) continue;

      const state = this.fileStates.get(log.path) ?? { lastLine: null };
      let start = 0;
      if (state.lastLine != null) {
        const anchor = lines.lastIndexOf(state.lastLine);
        // Anchor found → append only what came after it. Anchor lost (rotation or >1000
        // lines of growth) → treat the current tail as a fresh file; the caller may see a
        // small overlap, which is safer than silently missing new lines.
        start = anchor >= 0 ? anchor + 1 : 0;
      }

      for (let i = start; i < lines.length; i++) {
        this.append(log.file, log.path, lines[i]);
      }
      state.lastLine = lines[lines.length - 1];
      this.fileStates.set(log.path, state);
    }

    return result;
  }

  /** Query buffered entries by cursor, optional regex, and tail limit. */
  query(opts: McpLogQueryOptions = {}): McpLogQueryResult {
    const sinceId = Math.max(0, opts.sinceId ?? 0);
    const limit = Math.max(1, Math.min(opts.limit ?? 100, 2000));
    const re = opts.pattern ? new RegExp(opts.pattern, 'i') : null;

    const matched = this.entries.filter(
      (e) => e.id >= sinceId && (!re || re.test(e.message)),
    );
    const entries = matched.slice(-limit);

    let missed = 0;
    if (sinceId > 0 && this.entries.length > 0 && sinceId < this.entries[0].id) {
      missed = this.entries[0].id - sinceId;
    }

    return {
      entries,
      nextId: this.nextId,
      missed,
      droppedTotal: this.droppedTotal,
      buffered: this.entries.length,
      ...(missed > 0
        ? {
            warning:
              `${missed} entries were evicted from the buffer before this read. ` +
              `Poll more often or raise the MCP log buffer capacity to avoid gaps.`,
          }
        : {}),
    };
  }

  /** Entries around a given id, for showing what led up to a wait_for_log match. */
  contextAround(id: number, before = 5, after = 3): McpLogEntry[] {
    const index = this.entries.findIndex((e) => e.id === id);
    if (index < 0) return [];
    return this.entries.slice(Math.max(0, index - before), index + after + 1);
  }

  /**
   * Block until a log line matching `pattern` appears (checking already-buffered entries
   * first), or the timeout elapses. Returns the match plus surrounding context.
   */
  async waitFor(
    opts: ReadGameLogsOptions,
    pattern: string,
    timeoutMs: number,
    sinceId = 0,
  ): Promise<McpLogWaitResult> {
    const startedAt = Date.now();
    const deadline = startedAt + Math.max(0, timeoutMs);

    // Check the current buffer before polling so a line that landed between the caller's
    // last read and this call is not missed.
    let q = this.query({ sinceId, pattern, limit: 1 });
    while (q.entries.length === 0 && Date.now() < deadline) {
      this.refresh(opts);
      q = this.query({ sinceId, pattern, limit: 1 });
      if (q.entries.length === 0) {
        const remaining = deadline - Date.now();
        if (remaining > 0) await sleep(Math.min(200, remaining));
      }
    }

    const waitedMs = Date.now() - startedAt;
    if (q.entries.length === 0) {
      return {
        matched: false,
        waitedMs,
        timeoutMs,
        nextId: this.nextId,
        hint:
          'Nothing matched within the timeout. The pattern may be wrong, the event may not ' +
          'have happened, or the log file may not be the one being written.',
      };
    }

    const entry = q.entries[0];
    return {
      matched: true,
      waitedMs,
      timeoutMs,
      nextId: this.nextId,
      entry,
      context: this.contextAround(entry.id),
    };
  }

  private append(file: string, path: string, message: string): void {
    this.entries.push({
      id: this.nextId++,
      ts: Date.now(),
      file,
      path,
      source: 'game',
      message,
    });
    if (this.entries.length > this.capacity) {
      this.entries.shift();
      this.droppedTotal++;
    }
  }
}
