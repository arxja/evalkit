#!/usr/bin/env bun
import { run } from "./runner";
import { printRun } from "./report/console";

const args = process.argv.slice(2);
const cmd = args[0];

async function main() {
  if (cmd === "run") {
    const [evalsetPath, targetPath] = args.slice(1);
    if (!evalsetPath || !targetPath) {
      console.error("usage: evalkit run <evalset.jsonl> <target.ts>");
      process.exit(1);
    }
    const results = await run({ evalsetPath, targetPath });
    printRun(results);
    return;
  }
  console.error("usage: evalkit run <evalset.jsonl> <target.ts>");
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
