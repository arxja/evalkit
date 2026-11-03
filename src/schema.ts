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
