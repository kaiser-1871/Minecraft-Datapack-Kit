// macro-expand.ts — expand `$` macro lines for full command validation.
//
// The engine treats macro lines as opaque text, so dpkit cannot validate a `$` line's
// command structure until `$(var)` placeholders are replaced with concrete values. This
// module does the textual substitution only; validation is delegated to checkCommand.
// When a placeholder is missing an argument, the line is marked unverified — never an error.

import { join } from 'node:path';

export interface MacroExpandLine {
  /** 1-based line number. */
  line: number;
  /** The raw line as stored in the file (including the leading `$`). */
  original: string;
  /** The substituted command (without the leading `$`) when fully expanded; null when unverified. */
  expanded: string | null;
  /** True when the line was fully expanded (all placeholders had values). */
  checked: boolean;
  /** Reason when the line could not be fully expanded. */
  unverified_reason?: string;
}

export interface MacroExpandResult {
  lines: MacroExpandLine[];
  /** True when every macro command line was fully expanded. */
  fullyChecked: boolean;
  /** Number of macro command lines (excluding `$name = value` assignments). */
  macroLineCount: number;
}

const MACRO_ASSIGNMENT_RE = /^\$\w+\s*=/;

/** Extract every `$(var)` placeholder name from a macro command string. */
export function macroVariables(text: string): string[] {
  const out: string[] = [];
  const re = /\$\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.push(m[1]);
  return out;
}

/**
 * Expand all `$` macro command lines in a function file.
 *
 * @param text full .mcfunction file text
 * @param args macro variable values; undefined means "no args supplied"
 */
export function expandMacroText(text: string, args?: Record<string, unknown>): MacroExpandResult {
  const lines: MacroExpandLine[] = [];
  let fullyChecked = true;

  text.split('\n').forEach((rawLine, idx) => {
    const lineNo = idx + 1;
    const trimmed = rawLine.trimStart();
    if (!trimmed.startsWith('$')) return;
    if (MACRO_ASSIGNMENT_RE.test(trimmed)) return;

    const rest = trimmed.slice(1).trimStart();
    if (!rest) return;

    const vars = macroVariables(rest);
    const missing = args === undefined
      ? vars
      : vars.filter(v => args[v] === undefined);

    if (missing.length > 0) {
      fullyChecked = false;
      lines.push({
        line: lineNo,
        original: rawLine,
        expanded: null,
        checked: false,
        unverified_reason: `missing macro arg(s): ${missing.join(', ')}`,
      });
      return;
    }

    let expanded = rest;
    if (args !== undefined) {
      for (const v of vars) {
        const value = String(args[v]);
        // Replace all occurrences of this placeholder. Placeholder names are simple and
        // cannot contain `$`, so a plain split/join is safe.
        expanded = expanded.split(`$(${v})`).join(value);
      }
    }

    lines.push({
      line: lineNo,
      original: rawLine,
      expanded,
      checked: true,
    });
  });

  return { lines, fullyChecked, macroLineCount: lines.length };
}

/** Resolve a function id (`ns:path`) to the absolute .mcfunction path under a datapack. */
export function resolveFunctionPath(datapack: string, functionId: string): string {
  const colon = functionId.indexOf(':');
  if (colon <= 0 || colon === functionId.length - 1) {
    throw new Error(`[macro] expected a namespaced function id like battle:archer/pierce_summon (got ${functionId})`);
  }
  const ns = functionId.slice(0, colon);
  const path = functionId.slice(colon + 1);
  return join(datapack, 'data', ns, 'function', ...path.split('/')) + '.mcfunction';
}
