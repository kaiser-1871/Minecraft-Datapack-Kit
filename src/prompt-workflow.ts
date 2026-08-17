// prompt-workflow.ts — the "dpkit-workflow" prompt (prompts/list + prompts/get).
// The workflow text is embedded as a TS string constant on purpose: dist/ is a self-contained
// esbuild bundle, so a runtime fs.readFile of a repo-relative path would break at runtime.
// Tool names below must match the names registered in src/mcp.ts EXACTLY (query_syntax,
// list_registry, check_datapack, scan_gotchas, read_logs).
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export const DP_KIT_WORKFLOW_PROMPT = `dpkit version-first workflow
--------------------------------
You are checking or authoring a Minecraft datapack with dpkit. Work version-first, never from memory.

1. Determine the target version.
   Read the datapack's pack.mcmeta and use its pack format as the primary signal, but pin the version
   explicitly when it matters. A pack with min_format / max_format AND a base pack_format prefers the
   matching release when that dpv is inside the range; range-only packs still resolve to the newest
   in-range release — pin --version= (or the config's "version") when that is not the intended target.
   When starting a fresh pack, call get_pack_meta to get the exact pack_format and a pack.mcmeta example.

2. Check ground-truth syntax before writing or fixing any command.
   Call query_syntax with the command path (e.g. "execute on" or "damage") and the target version.
   Never guess a subcommand or an enum value from memory — grammar differs per version and the cached
   per-version command tree is the only trustworthy source. Raise depth= for deeper nested expansion.

3. Verify every registry ID before writing it.
   Call list_registry with the registry name (e.g. mob_effect, attribute, damage_type) and the pinned
   target version, and confirm the ID exists there. Never assume an ID from one version exists in
   another (e.g. 1.20.4 has the attribute "generic.attack_speed" while 26.2 has "attack_speed").
   This matters most inside $ macro lines, where the engine does not validate IDs.

4. Check the whole datapack after changing anything.
   Run check_datapack against the datapack and version, then fix every reported error until the summary
   shows zero errors (and zero warnings under --strict). Re-check after each round of edits.

5. Sweep for silent-failure patterns.
   Run scan_gotchas to catch known patterns that do not fail loudly in-game: advancement damage nesting,
   particle map syntax, summon NBT casing, and advancement criteria+OR.

6. Diagnose runtime problems with the game log.
   If the datapack runs but misbehaves, use read_logs to tail the active launcher's latest.log (official
   / Prism / TLauncher, including rotated .log.gz files). After triggering a reload or command in-game,
   use wait_for_log with a pattern like "Failed to load|Couldn't load" instead of polling read_logs.

Rules of thumb: prefer query_syntax over memory for grammar; prefer list_registry over memory for IDs;
and always finish with a clean check_datapack. All tools are version-aware — pass the resolved target
version to each one.

Reading results: every tool returns a JSON envelope — ok:true on success, {error, ok:false} on
failure. Large arrays come truncated with total/truncated/hint; narrow them with search= (or block=)
instead of requesting everything at once.

Known limits:
- complete_at returns no completions on $ macro lines (the engine does not parse them). Complete the
  fragment on a normal line first, then move it back to the macro form.
- An ok:false error about missing cached data ("No version data cached locally" / "not cached") is not
  a bad call: run one check online to download the version's data, and all tools then work offline.`;

/** Register the version-first workflow prompt on the given MCP server. */
export function registerWorkflowPrompt(server: McpServer): void {
  server.registerPrompt('dpkit-workflow', {
    title: 'dpkit version-first workflow',
    description:
      'Step-by-step workflow for checking/authoring a Minecraft datapack with dpkit: pin the version, ' +
      'verify command syntax (query_syntax) and registry IDs (list_registry) before writing, then run ' +
      'check_datapack and clear every error, and use scan_gotchas / read_logs for silent or runtime issues.',
  }, () => ({
    description: 'Version-first workflow for dpkit datapack checking/authoring.',
    messages: [{ role: 'user' as const, content: { type: 'text' as const, text: DP_KIT_WORKFLOW_PROMPT } }],
  }));
}
