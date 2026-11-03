import type { Database } from "bun:sqlite";
import type { ScorerFn } from "./types";
import { judgeCase } from "../judge/client";

export function makeJudgeScorer(db: Database): ScorerFn {
  return async (c, actual) => {
    const v = await judgeCase(db, c.input, c.expected, actual);
    return { passed: v.verdict === "pass", reason: v.reason };
  };
}
