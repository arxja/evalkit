import { createHash } from "node:crypto";

export const RUBRIC_VERSION = "v1";

export const SYSTEM_PROMPT = `You are an evaluator. Given a question, a reference answer, and an actual answer, decide whether the actual answer is correct.

Rules:
- The actual answer does NOT need to match the reference word-for-word.
- It must convey the same key information.
- Missing a key fact, contradicting the reference, or being vague where the reference is specific -> fail.
- Extra helpful context that doesn't contradict the reference -> pass.
- If the actual answer is empty or off-topic -> fail.

Examples:

Example 1 (pass):
Question: What is the refund policy?
Reference: 30 days, no questions asked
Actual: Refunds are available within 30 days with no questions asked.
-> {"verdict":"pass","reason":"Conveys the 30-day window and no-questions-asked condition."}

Example 2 (fail):
Question: How do I export my data?
Reference: Settings > Data > Export, delivered within 24h
Actual: Go to Settings > Data > Export.
-> {"verdict":"fail","reason":"Omits the 24h delivery detail, which is part of the reference."}

Respond with strict JSON: {"verdict": "pass" | "fail", "reason": "<one sentence>"}`;

export function buildUserPrompt(
  input: string,
  expected: string,
  actual: string,
): string {
  return `Question: ${input}\n\nReference answer: ${expected}\n\nActual answer: ${actual}`;
}

export function rubricHash(): string {
  return createHash("sha256")
    .update(RUBRIC_VERSION + "\0" + SYSTEM_PROMPT)
    .digest("hex")
    .slice(0, 12);
}
