// mcp-shape.ts — shared output shaping for the MCP tools: array truncation plus
// success/error envelopes. The iron rule for every consumer of these helpers: never REMOVE an
// existing top-level key — the envelope only ADDS metadata (ok / count / total / truncated / hint)
// and truncates oversized arrays, so tests/mcp-smoke.mjs and existing API clients keep their shape.
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/** Default cap for array truncation (how many items are returned). */
export const DEFAULT_TRUNCATE_LIMIT = 100;

/** Result of truncating an array: `items` is the returned slice, `total` the full length. */
export interface Truncated<T> {
  items: T[];
  /** Full (pre-truncation) length. */
  total: number;
  /** True when items were cut to `items`. */
  truncated: boolean;
  /** User hint (e.g. "pass search= to filter") present only when truncated. */
  hint?: string;
}

/** Slice a (possibly large) array down to `limit` items, reporting the full total. */
export function truncate<T>(
  arr: readonly T[] | undefined | null,
  limit = DEFAULT_TRUNCATE_LIMIT,
  hint?: string,
): Truncated<T> {
  const items: T[] = arr ? Array.from(arr) : [];
  const total = items.length;
  const truncated = total > limit;
  return {
    items: truncated ? items.slice(0, limit) : items,
    total,
    truncated,
    ...(truncated && hint ? { hint } : {}),
  };
}

/** Success envelope: add ok:true without touching any existing key. */
export function ok<T extends object>(data: T): T & { ok: true } {
  return { ok: true as const, ...data } as T & { ok: true };
}

/** Serialize a value as the single text content block of a successful tool result. */
export function jsonResult(value: object): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}

/** Error envelope: keep the legacy {error} JSON + isError:true, and add ok:false for symmetry. */
export function errResult(e: unknown): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: e instanceof Error ? e.message : String(e), ok: false }) }],
    isError: true,
  };
}
