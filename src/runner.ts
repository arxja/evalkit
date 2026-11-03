import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  GoldenCaseSchema,
  type CaseResult,
  type GoldenCase,
  type RunRecord,
} from "./schema";
import type { ScorerFn } from "./scorers/types";
import { exact } from "./scorers/exact";
import { sha256, gitSha, gitDirty } from "./config";
import { saveRun } from "./store";
import type { Database } from "bun:sqlite";

export type Target = (input: string) => Promise<string>;

export async function loadEvalset(p: string): Promise<GoldenCase[]> {
  const text = await Bun.file(p).text();
  return text
    .split("\n")
    .filter((l) => l.trim())
    .map((line, i) => {
      try {
        return GoldenCaseSchema.parse(JSON.parse(line));
      } catch (e: any) {
        throw new Error(`Invalid case at line ${i + 1} of ${p}: ${e.message}`);
      }
    });
}

export async function loadTarget(p: string): Promise<Target> {
  const abs = path.resolve(p);
  const mod = await import(pathToFileURL(abs).href);
  const fn = mod.default;
  if (typeof fn !== "function") {
    throw new Error(
      `Target ${p} must default-export an async (input: string) => string function`,
    );
  }
  return fn as Target;
}

export interface RunOptions {
  db: Database;
  evalsetPath: string;
  targetPath: string;
}
export async function run(opts: RunOptions): Promise<RunRecord> {
  const cases = await loadEvalset(opts.evalsetPath);
  const target = await loadTarget(opts.targetPath);
  const scorer: ScorerFn = exact;

  const results: CaseResult[] = [];
  for (const c of cases) {
    let actual = "";
    let status: "ok" | "error" = "ok";
    let score = { passed: false, reason: "" };
    try {
      actual = String(await target(c.input));
    } catch (e: any) {
      status = "error";
      actual = `<<error: ${e?.message ?? e}>>`;
    }
    if (status === "error") {
      score = { passed: false, reason: `target error: ${actual}` };
    } else {
      score = await scorer(c, actual);
    }
    results.push({
      case: c,
      actual,
      status,
      passed: score.passed,
      reason: score.reason,
    });
  }
  const record: RunRecord = {
    timestamp: new Date().toISOString(),
    gitSha: await gitSha(),
    gitDirty: await gitDirty(),
    evalsetHash: sha256(JSON.stringify(cases)),
    scorer: "exact",
    judgeModel: null,
    rubricHash: null,
    cases: results,
  };

  const id = saveRun(opts.db, record);
  return { ...record, id };
}
