import type { Database } from "bun:sqlite";
import { VerdictSchema, type Verdict } from "../schema";
import { JUDGE_API_KEY, JUDGE_BASE_URL, JUDGE_MODEL, sha256 } from "../config";
import { SYSTEM_PROMPT, RUBRIC_VERSION, buildUserPrompt } from "./prompt";
import { getJudgeCache, setJudgeCache } from "../store";

function cacheKey(input: string, expected: string, actual: string): string {
  return sha256(
    [JUDGE_MODEL, RUBRIC_VERSION, input, expected, actual].join("\0"),
  );
}

export async function judgeCase(
  db: Database,
  input: string,
  expected: string,
  actual: string,
): Promise<Verdict> {
  const key = cacheKey(input, expected, actual);
  const cached = getJudgeCache(db, key);
  if (cached) return cached;

  if (!JUDGE_API_KEY) {
    throw new Error("JUDGE_API_KEY is not set (needed for the judge scorer).");
  }

  const res = await fetch(`${JUDGE_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${JUDGE_API_KEY}`,
    },
    body: JSON.stringify({
      model: JUDGE_MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(input, expected, actual) },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`Judge API ${res.status}: ${await res.text()}`);
  }

  const body = (await res.json()) as {
    choices: { message: { content: string } }[];
  };
  const raw = body.choices?.[0]?.message?.content ?? "";
  const parsed = VerdictSchema.parse(JSON.parse(raw));

  setJudgeCache(db, key, parsed);
  return parsed;
}
