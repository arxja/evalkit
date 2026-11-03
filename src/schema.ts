import { z } from "zod";

export const GoldenCaseSchema = z.object({
  id: z.string(),
  input: z.string(),
  expected: z.string(),
  tags: z.array(z.string()).default([]),
});

export type GoldenCase = z.infer<typeof GoldenCaseSchema>;

export interface CaseResult {
  case: GoldenCase;
  actual: string;
  status: "ok" | "error";
  passed: boolean;
  reason: string;
}

export interface RunRecord {
  id?: number; // populated after save
  timestamp: string;
  gitSha: string | null;
  gitDirty: boolean;
  evalsetHash: string;
  scorer: string;
  judgeModel: string | null;
  rubricHash: string | null;
  cases: CaseResult[];
}

export const VerdictSchema = z.object({
  verdict: z.enum(["pass", "fail"]),
  reason: z.string(),
});

export type Verdict = z.infer<typeof VerdictSchema>;

export type Scorer = "exact" | "contains" | "judge";

export const LabeledCaseSchema = GoldenCaseSchema.extend({
  actual: z.string(),
  human_verdict: z.enum(["pass", "fail"]),
});
export type LabeledCase = z.infer<typeof LabeledCaseSchema>;
