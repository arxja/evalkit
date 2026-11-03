import type { CaseResult } from "../schema";

export function printRun(results: CaseResult[]): void {
  console.log("");
  for (const c of results) {
    const icon = c.passed ? "✓" : "✗";
    const tags = c.case.tags.length ? ` [${c.case.tags.join(", ")}]` : "";
    console.log(`${icon} ${c.case.id}${tags}  ${c.reason}`);
  }
  const passed = results.filter((c) => c.passed).length;
  console.log(`\n${passed}/${results.length} pass`);
}
