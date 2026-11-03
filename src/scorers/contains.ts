import type { ScorerFn } from "./types";

export const contains: ScorerFn = async (c, actual) => {
  const passed = actual.toLowerCase().includes(c.expected.toLowerCase());
  return {
    passed,
    reason: passed
      ? "expected substring present"
      : "expected substring not found",
  };
};
