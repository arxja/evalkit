import path from "node:path";
import type { Database } from "bun:sqlite";
import type { RunRecord } from "../schema";
import { listRuns, getRun } from "../store";

interface DashboardRun {
  id: number;
  timestamp: string;
  gitSha: string | null;
  gitDirty: boolean;
  scorer: string;
  judgeModel: string | null;
  total: number;
  passed: number;
  tags: { tag: string; pass: number; total: number }[];
  cases: {
    id: string;
    input: string;
    expected: string;
    actual: string;
    tags: string[];
    passed: boolean;
    reason: string;
    status: string;
  }[];
}

export async function exportDashboard(
  db: Database,
  outDir: string,
): Promise<string> {
  const summaries = listRuns(db);
  const runs: DashboardRun[] = [];
  for (const s of summaries) {
    const full = getRun(db, s.id);
    if (full) runs.push(toDashboardRun(full));
  }

  const templatePath = path.join(import.meta.dir, "dashboard.html");
  const template = await Bun.file(templatePath).text();
  const json = JSON.stringify(runs).replace(/</g, "\\u003c");
  const html = template.replace("__RUNS_JSON__", json);

  await Bun.write(path.join(outDir, "index.html"), html);
  return path.join(outDir, "index.html");
}

function toDashboardRun(run: RunRecord): DashboardRun {
  const tags = new Map<string, { pass: number; total: number }>();
  for (const c of run.cases) {
    for (const t of c.case.tags.length ? c.case.tags : ["(untagged)"]) {
      const s = tags.get(t) ?? { pass: 0, total: 0 };
      s.total++;
      if (c.passed) s.pass++;
      tags.set(t, s);
    }
  }
  return {
    id: run.id!,
    timestamp: run.timestamp,
    gitSha: run.gitSha,
    gitDirty: run.gitDirty,
    scorer: run.scorer,
    judgeModel: run.judgeModel,
    total: run.cases.length,
    passed: run.cases.filter((c) => c.passed).length,
    tags: [...tags].map(([tag, s]) => ({ tag, ...s })),
    cases: run.cases.map((c) => ({
      id: c.case.id,
      input: c.case.input,
      expected: c.case.expected,
      actual: c.actual,
      tags: c.case.tags,
      passed: c.passed,
      reason: c.reason,
      status: c.status,
    })),
  };
}
