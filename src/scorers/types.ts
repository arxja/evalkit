import type { GoldenCase } from "../schema";

export interface ScoreResult {
  passed: boolean;
  reason: string;
}

export type ScorerFn = (c: GoldenCase, actual: string) => Promise<ScoreResult>;
