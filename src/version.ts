// version.ts — compare Minecraft game version strings ("1.21.5", "26.1", "26.3-snapshot-2").
// Used to apply mcdoc #[since=]/#[until=] annotations in the entity-NBT schema. The scheme is
// numeric dotted tuples; the "26.x" series sorts after "1.21.x" because 1 < 26, which matches
// the real release order (… 1.21.11 → 26.1 → 26.2 → …). A trailing non-numeric suffix
// ("-snapshot-…") is ignored, and a missing tail component compares as 0 ("26.1" < "26.1.2").

/** Leading numeric dotted components of a version string (ignores "-snapshot-…" etc.). */
export function versionParts(v: string): number[] {
  const out: number[] = [];
  for (const seg of v.split('.')) {
    const m = seg.match(/^\d+/);
    if (!m) break;
    out.push(Number(m[0]));
  }
  return out;
}

/** Negative if a < b, 0 if equal, positive if a > b. */
export function compareGameVersions(a: string, b: string): number {
  const pa = versionParts(a), pb = versionParts(b);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const x = pa[i] ?? 0, y = pb[i] ?? 0;
    if (x !== y) return x - y;
  }
  return 0;
}