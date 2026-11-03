import type { ScorerFn } from "./types";

export const exact: ScorerFn = async (c, actual) => {
  const passed = actual.trim() === c.expected.trim();
  return {
    passed,
    reason: passed
      ? "exact match"
      : "expected exact match, got a different string",
  };
};
