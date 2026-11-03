import { createHash } from "node:crypto";

export const DB_PATH = process.env.EVALKIT_DB ?? "evalkit.db";

export const sha256 = (s: string): string =>
  createHash("sha256").update(s).digest("hex");

export async function gitSha(): Promise<string | null> {
  try {
    const proc = Bun.spawn(["git", "rev-parse", "HEAD"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    if ((await proc.exited) !== 0) return null;
    return (await new Response(proc.stdout).text()).trim();
  } catch {
    return null;
  }
}

export async function gitDirty(): Promise<boolean> {
  try {
    const proc = Bun.spawn(["git", "status", "--porcelain"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    if ((await proc.exited) !== 0) return false;
    return (await new Response(proc.stdout).text()).trim().length > 0;
  } catch {
    return false;
  }
}

export const JUDGE_BASE_URL =
  process.env.JUDGE_BASE_URL ?? "https://api.openai.com/v1";
export const JUDGE_API_KEY = process.env.JUDGE_API_KEY ?? "";
export const JUDGE_MODEL = process.env.JUDGE_MODEL ?? "gpt-4o-mini";
