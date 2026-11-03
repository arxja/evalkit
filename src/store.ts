import { Database } from "bun:sqlite";
import type { RunRecord, CaseResult } from "./schema";

export function openDb(path: string): Database {
  const db = new Database(path, { create: true });
  db.run("PRAGMA journal_mode = WAL;");
  db.run(`
    CREATE TABLE IF NOT EXISTS runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      git_sha TEXT,
      git_dirty INTEGER NOT NULL DEFAULT 0,
      evalset_hash TEXT NOT NULL,
      scorer TEXT NOT NULL,
      judge_model TEXT,
      rubric_hash TEXT,
      total INTEGER NOT NULL,
      passed INTEGER NOT NULL
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
      case_id TEXT NOT NULL,
      input TEXT NOT NULL,
      expected TEXT NOT NULL,
      actual TEXT NOT NULL,
      status TEXT NOT NULL,
      tags TEXT NOT NULL,
      passed INTEGER NOT NULL,
      reason TEXT NOT NULL
    );
  `);
  return db;
}

export function saveRun(db: Database, run: RunRecord): number {
  const passed = run.cases.filter((c) => c.passed).length;
  return db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO runs (timestamp, git_sha, git_dirty, evalset_hash, scorer, judge_model, rubric_hash, total, passed)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        run.timestamp,
        run.gitSha,
        run.gitDirty ? 1 : 0,
        run.evalsetHash,
        run.scorer,
        run.judgeModel,
        run.rubricHash,
        run.cases.length,
        passed,
      );
    const runId = Number(info.lastInsertRowid);
    const insertCase = db.prepare(
      `INSERT INTO cases (run_id, case_id, input, expected, actual, status, tags, passed, reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const c of run.cases) {
      insertCase.run(
        runId,
        c.case.id,
        c.case.input,
        c.case.expected,
        c.actual,
        c.status,
        JSON.stringify(c.case.tags),
        c.passed ? 1 : 0,
        c.reason,
      );
    }
    return runId;
  })();
}

export interface RunSummary {
  id: number;
  timestamp: string;
  gitSha: string | null;
  gitDirty: boolean;
  evalsetHash: string;
  scorer: string;
  judgeModel: string | null;
  rubricHash: string | null;
  total: number;
  passed: number;
}

export function listRuns(db: Database): RunSummary[] {
  return db
    .query(
      `SELECT id, timestamp, git_sha as gitSha, git_dirty as gitDirty,
              evalset_hash as evalsetHash, scorer, judge_model as judgeModel,
              rubric_hash as rubricHash, total, passed
       FROM runs ORDER BY id DESC`,
    )
    .all() as RunSummary[];
}

export function getRun(db: Database, id: number): RunRecord | null {
  const run = db
    .query(
      `SELECT id, timestamp, git_sha as gitSha, git_dirty as gitDirty,
              evalset_hash as evalsetHash, scorer, judge_model as judgeModel,
              rubric_hash as rubricHash
       FROM runs WHERE id = ?`,
    )
    .get(id) as Omit<RunRecord, "cases"> | null;
  if (!run) return null;
  const rows = db
    .query(
      `SELECT case_id as caseId, input, expected, actual, status, tags, passed, reason
       FROM cases WHERE run_id = ? ORDER BY id`,
    )
    .all(id) as Array<{
    caseId: string;
    input: string;
    expected: string;
    actual: string;
    status: "ok" | "error";
    tags: string;
    passed: number;
    reason: string;
  }>;
  return {
    ...run,
    gitDirty: Boolean(run.gitDirty),
    cases: rows.map(
      (c): CaseResult => ({
        case: {
          id: c.caseId,
          input: c.input,
          expected: c.expected,
          tags: JSON.parse(c.tags),
        },
        actual: c.actual,
        status: c.status,
        passed: Boolean(c.passed),
        reason: c.reason,
      }),
    ),
  };
}
