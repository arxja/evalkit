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
