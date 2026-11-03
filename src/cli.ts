#!/usr/bin/env bun
import { run } from "./runner";
import { printRun, printCompare } from "./report/console";
import { openDb, listRuns, getRun } from "./store";
import { DB_PATH } from "./config";
import type { Scorer } from "./schema";

const args = process.argv.slice(2);
const cmd = args[0];

function parseArgs(argv: string[]): {
  positional: string[];
  flags: Record<string, string>;
} {
  const positional: string[] = [];
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === undefined) continue;
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = "true";
      }
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}
async function main() {
  const db = openDb(DB_PATH);

  if (cmd === "run") {
    const { positional, flags } = parseArgs(args.slice(1));
    const [evalsetPath, targetPath] = positional;
    if (!evalsetPath || !targetPath) {
      console.error(
        "usage: evalkit run <evalset.jsonl> <target.ts> [--scorer exact|contains|judge]",
      );
      process.exit(1);
    }
    const scorer = (flags.scorer ?? "exact") as Scorer;
    const record = await run({ db, evalsetPath, targetPath, scorer });
    printRun(record);
    return;
  }

  if (cmd === "compare") {
    const runs = listRuns(db);
    if (runs.length < 2) {
      console.error("Need at least two runs to compare.");
      process.exit(1);
    }
    const [cur, prev] = runs;
    if (!cur || !prev) {
      console.error("Need at least two runs to compare.");
      process.exit(1);
    }
    const curFull = getRun(db, cur.id);
    const prevFull = getRun(db, prev.id);
    if (!curFull || !prevFull) {
      console.error("Run not found.");
      process.exit(1);
    }
    printCompare(curFull, prevFull);
    return;
  }

  if (cmd === "list") {
    for (const r of listRuns(db)) {
      console.log(
        `#${r.id}  ${r.timestamp}  ${r.passed}/${r.total}  ${r.scorer}  ${r.gitSha?.slice(0, 7) ?? "no-git"}${r.gitDirty ? "-dirty" : ""}`,
      );
    }
    return;
  }

  if (cmd === "agreement") {
    const { positional } = parseArgs(args.slice(1));
    const labeledPath = positional[0];
    if (!labeledPath) {
      console.error("usage: evalkit agreement <labeled.jsonl>");
      process.exit(1);
    }
    const { LabeledCaseSchema } = await import("./schema");
    const { judgeCase } = await import("./judge/client");
    const { computeAgreement } = await import("./judge/agreement");

    const text = await Bun.file(labeledPath).text();
    const labeled = text
      .split("\n")
      .filter((l) => l.trim())
      .map((line, i) => {
        try {
          return LabeledCaseSchema.parse(JSON.parse(line));
        } catch (e: any) {
          throw new Error(
            `Invalid labeled case at line ${i + 1}: ${e.message}`,
          );
        }
      });

    const perCase = [];
    for (const c of labeled) {
      const v = await judgeCase(db, c.input, c.expected, c.actual);
      perCase.push({
        id: c.id,
        human: c.human_verdict,
        judge: v.verdict,
        agree: v.verdict === c.human_verdict,
      });
    }

    const report = computeAgreement(perCase);
    for (const r of report.perCase) {
      const icon = r.agree ? "✓" : "✗";
      console.log(`${icon} ${r.id}  human=${r.human}  judge=${r.judge}`);
    }
    console.log(
      `\n${report.agree}/${report.total} agree (${report.rate.toFixed(2)})`,
    );
    if (report.rate < 0.75) {
      console.warn(
        "⚠ below 0.75 — the judge is not trustworthy. Rewrite the rubric before trusting its scores.",
      );
    }
    return;
  }

  console.error("usage: evalkit <run|compare|list> [args]");
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
