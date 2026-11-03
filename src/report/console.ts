import type { CaseResult, RunRecord } from "../schema";

export function printRun(record: RunRecord): void {
  console.log("");
  for (const c of record.cases) {
    const icon = c.passed ? "✓" : "✗";
    const tags = c.case.tags.length ? ` [${c.case.tags.join(", ")}]` : "";
    console.log(`${icon} ${c.case.id}${tags}  ${c.reason}`);
  }
  const passed = record.cases.filter((c) => c.passed).length;
  console.log(`\n${passed}/${record.cases.length} pass`);
}

function tagStats(cases: CaseResult[]) {
  const m = new Map<string, { pass: number; total: number }>();
  for (const c of cases) {
    for (const t of c.case.tags.length ? c.case.tags : ["(untagged)"]) {
      const s = m.get(t) ?? { pass: 0, total: 0 };
      s.total++;
      if (c.passed) s.pass++;
      m.set(t, s);
    }
  }
  return m;
}

export function printTagDiff(
  current: CaseResult[],
  previous: CaseResult[],
): void {
  const cur = tagStats(current);
  const prev = tagStats(previous);
  const all = new Set([...cur.keys(), ...prev.keys()]);
  const lines: string[] = [];
  for (const t of all) {
    const c = cur.get(t) ?? { pass: 0, total: 0 };
    const p = prev.get(t) ?? { pass: 0, total: 0 };
    const delta = c.pass - p.pass;
    const arrow = delta > 0 ? "↑" : delta < 0 ? "↓" : "=";
    const suffix = delta !== 0 ? Math.abs(delta) : "";
    lines.push(
      `${t}: ${p.pass}/${p.total} → ${c.pass}/${c.total} ${arrow}${suffix}`,
    );
  }
  if (lines.length) console.log("\nper-tag:\n  " + lines.join("\n  "));
}

export function printCompare(current: RunRecord, previous: RunRecord): void {
  const curPassed = current.cases.filter((c) => c.passed).length;
  const prevPassed = previous.cases.filter((c) => c.passed).length;

  if (previous.evalsetHash !== current.evalsetHash) {
    console.warn(
      "⚠ evalset changed between runs — diff may not be meaningful.",
    );
  }
  if (
    previous.scorer !== current.scorer ||
    (previous.judgeModel ?? null) !== (current.judgeModel ?? null) ||
    (previous.rubricHash ?? null) !== (current.rubricHash ?? null)
  ) {
    console.warn(
      "⚠ scorer/judge/rubric changed — diff may reflect the judge, not the target.",
    );
  }

  const delta = curPassed - prevPassed;
  const sign = delta >= 0 ? "+" : "";
  console.log(
    `${prevPassed}/${previous.cases.length} → ${curPassed}/${current.cases.length} (${sign}${delta})  ` +
      `[#${previous.id} → #${current.id}]`,
  );

  printTagDiff(current.cases, previous.cases);
}
