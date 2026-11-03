#!/usr/bin/env bun
import { run } from "./runner";
import { printRun, printCompare } from "./report/console";
import { openDb, listRuns, getRun } from "./store";
import { DB_PATH } from "./config";

const args = process.argv.slice(2);
const cmd = args[0];

async function main() {
  const db = openDb(DB_PATH);

  if (cmd === "run") {
    const [evalsetPath, targetPath] = args.slice(1);
    if (!evalsetPath || !targetPath) {
      console.error("usage: evalkit run <evalset.jsonl> <target.ts>");
      process.exit(1);
    }
    const record = await run({ db, evalsetPath, targetPath });
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

  console.error("usage: evalkit <run|compare|list> [args]");
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
