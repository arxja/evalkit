# evalkit

A tiny eval harness for AI projects. You give it a golden set of cases, a target (any function, agent, or wrapped HTTP endpoint), and a scorer — it runs the cases, scores them, stores the run, and diffs against the last run **per tag** so you can see category collapse instead of a useless aggregate.

Built once, reused across projects. Add a new project by dropping a file in `targets/` and a file in `evalsets/` — no harness changes.

---

## Why

Aggregate accuracy hides category collapse. `85% → 82%` tells you something broke. `edge: 4/5 → 0/5` tells you _what_ broke. That's the whole point.

The second thing evals get wrong: **the judge is not trusted until it agrees with a human on hand-labeled cases.** An LLM judge that says "good" for everything gives you 100% and zero information. `evalkit agreement` exists to catch that.

---

## Stack

- **Bun** — runtime, package manager, test runner
- **zod** — validates golden set at load time (bad lines fail loudly, not silently)
- **bun:sqlite** — run history (no server, no ORM)
- **Alpine.js (CDN)** — the one-page dashboard; no build step

One dependency (`zod`). Everything else is the Bun standard library.

---

## Setup

```bash
# clone, cd, then:
bun install

# env for the judge (Google AI Studio shown; any OpenAI-compatible endpoint works)
export JUDGE_API_KEY="your-key"
export JUDGE_BASE_URL="https://generativelanguage.googleapis.com/v1beta/openai"
export JUDGE_MODEL="gemini-2.5-flash-lite"
```

**Judge providers** — `JUDGE_BASE_URL` is an OpenAI-compatible endpoint. Works out of the box with:

| Provider         | `JUDGE_BASE_URL`                                          | Example model             |
| ---------------- | --------------------------------------------------------- | ------------------------- |
| OpenAI           | `https://api.openai.com/v1`                               | `gpt-4o-mini`             |
| Google AI Studio | `https://generativelanguage.googleapis.com/v1beta/openai` | `gemini-2.5-flash-lite`   |
| OpenRouter       | `https://openrouter.ai/api/v1`                            | any routed model          |
| Ollama (local)   | `http://localhost:11434/v1`                               | `llama3.2`                |
| Groq             | `https://api.groq.com/openai/v1`                          | `llama-3.3-70b-versatile` |

Only the judge scorer needs the API. `exact` and `contains` never call out.

---

## Quickstart

```bash
# 1. run the example set against the example target
bun src/cli.ts run evalsets/example.jsonl targets/example.ts

# 2. run it again (a second data point to diff against)
bun src/cli.ts run evalsets/example.jsonl targets/example.ts

# 3. diff last two runs, per tag
bun src/cli.ts compare

# 4. judge scorer (needs JUDGE_API_KEY) — cached, so the second run is instant
bun src/cli.ts run evalsets/example.jsonl targets/example.ts --scorer judge

# 5. judge-vs-human agreement on a hand-labeled set
bun src/cli.ts agreement evalsets/labeled.jsonl

# 6. build the dashboard
bun src/cli.ts report
# open dashboard/index.html
```

Output of `run`:

```text
✓ q-001 [policy, easy]  exact match
✓ q-002 [policy, edge]  exact match
✓ q-003 [account, easy]  exact match
✓ q-004 [limits, easy]  exact match
✓ q-005 [enterprise, policy]  exact match
✗ q-006 [account, edge]  target error: <<error: no answer for: How do I export my data?>>

policy: 3/3 · easy: 3/3 · edge: 1/2 · account: 1/2 · limits: 1/1 · enterprise: 1/1
5/6 pass
```

Output of `compare`:

```text
5/6 → 4/6 (-1)  [#9 → #10]

per-tag:
  policy:      3/3 → 2/3 ↓1
  easy:        3/3 → 3/3 =
  edge:        1/2 → 1/2 =
  account:     1/2 → 1/2 =
  limits:      1/1 → 1/1 =
  enterprise:  1/1 → 0/1 ↓1
```

---

## Concepts

### Golden set

One JSON object per line in `evalsets/*.jsonl`. The `tags` field is the whole point — they're the coordinate system you use to find a regression.

```jsonl
{"id":"q-001","input":"What is the refund policy?","expected":"30 days, no questions asked","tags":["policy","easy"]}
{"id":"q-002","input":"Can I cancel after 30 days?","expected":"No, but you can downgrade","tags":["policy","edge"]}
```

**Choose tags as the subpopulations you care about when things go wrong.** If your product has a refund flow and a shipping flow, "policy" is not useful — "refund" and "shipping" are.

### Target

Any module in `targets/` that default-exports an async function:

```ts
export default async function target(input: string): Promise<string> {
  // whatever you're testing: an LLM call, a pipeline, an agent, an HTTP endpoint
  return "...";
}
```

**One string in, one string out.** This is the reusability seam — wrapping an HTTP endpoint, an agent, or a retrieval pipeline is one file that does the fetch/spawn/chain and returns a string. The harness never learns how the target works. When a new project arrives, the only thing that changes is a file in `targets/`.

### Scorers

Three of them, pick the simplest that can do the job:

| Scorer     | When to use                                    | Failure mode                                       |
| ---------- | ---------------------------------------------- | -------------------------------------------------- |
| `exact`    | Format _is_ correctness (labels, IDs, numbers) | Rejects paraphrases                                |
| `contains` | A specific fact must appear in the answer      | Case/word-boundary sensitive                       |
| `judge`    | Correctness is semantic (many valid phrasings) | Non-deterministic, fallible, needs agreement check |

**Reach for exact or contains first.** Most natural-language eval doesn't need a judge — "does the answer mention 30 days" doesn't require an LLM. Escalate to judge only when the simpler scorers genuinely can't do the job. Paying for the judge's fallibility when you don't need its flexibility is the most common eval mistake.

### Judge

Just another LLM call. The system prompt is the rubric — **your definition of good, written as prose the judge follows**. The rubric has a version (`RUBRIC_VERSION` in `src/judge/prompt.ts`) and a hash; each run records both, so `compare` refuses to diff across rubric changes.

**Two properties that make judge scores trustworthy:**

1. **Cache.** Verdicts are keyed by `(model, rubricVersion, input, expected, actual)`. Same inputs → same verdict, forever. This is what makes `compare` meaningful when the judge is non-deterministic.
2. **Pinning.** Every run records `judgeModel` and `rubricHash`. Diffing across a changed judge or changed rubric is meaningless — `compare` warns loudly when this happens.

`temperature: 0` reduces variance but doesn't eliminate it. The cache is what eliminates it.

### Agreement

The step that makes the judge trustworthy — and the one most teams skip. You hand-label ~10–50 cases (`pass` / `fail`) in `evalsets/labeled.jsonl`, then:

```jsonl
{
  "id": "a-001",
  "input": "...",
  "expected": "...",
  "actual": "...",
  "human_verdict": "pass",
  "tags": [
    "policy"
  ]
}
```

Run `evalkit agreement`. It compares the judge's verdicts against yours and prints a rate. **Below 0.75, the judge is broken** — rewrite the rubric, add worked examples, re-measure. Without this step, everything downstream (pass rate, diff, per-tag breakdown) is built on sand.

The two schema fields that matter:

- `actual` — frozen output. You're testing the _judge's_ consistency against a fixed answer, not the target's live output.
- `human_verdict` — _your_ call. The rate measures judge-vs-you, not judge-vs-someone-else's-definition.

---

## Reusing this in a new project

The harness is project-agnostic. Adding a project is two files.

**1. `targets/<project>.ts`** — wrap whatever you're testing:

```ts
// Example: wrap an HTTP endpoint
export default async function target(input: string): Promise<string> {
  const res = await fetch("https://api.example.com/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q: input }),
  });
  const body = (await res.json()) as { answer: string };
  return body.answer;
}
```

Or wrap an agent:

```ts
import { runAgent } from "../lib/agent";

export default async function target(input: string): Promise<string> {
  const result = await runAgent(input);
  return result.finalAnswer;
}
```

**2. `evalsets/<project>.jsonl`** — tags that matter for _that_ project.

Then:

```bash
bun src/cli.ts run evalsets/<project>.jsonl targets/<project>.ts
bun src/cli.ts run evalsets/<project>.jsonl targets/<project>.ts   # second run
bun src/cli.ts compare
```

If a new project needs a judge, and v1's rubric (facts-only) fits, reuse it. If not, bump `RUBRIC_VERSION` to v2 and add a rule — old runs stay pinned to v1.

**Do not change the harness to support a new project.** If you find yourself wanting to touch `runner.ts`, that's a signal: wrap at the boundary (the target file), not inside.

---

## Commands

```text
evalkit run       <evalset.jsonl> <target.ts> [--scorer exact|contains|judge]
evalkit compare   (diffs last two runs, per tag; warns on scorer/judge/rubric change)
evalkit agreement <labeled.jsonl>  (judge vs human, gate at 0.75)
evalkit report    (writes dashboard/index.html)
evalkit list      (all runs, newest first)
evalkit test      (bun test)
```

---

## What's deliberately out of scope (v1)

- **Pairwise scorers** — needs a different data model (two outputs per input). Not needed until you're A/B-ing models.
- **CI integration** — run it manually. Add CI after the tool proves itself on real projects.
- **Multi-user / hosted service** — local CLI, one user, one DB.
- **Streaming / live UI** — batches, runs on demand.
- **Metrics beyond pass/fail** — a run is a set of pass/fail cases. If you need a score, use `reason` to store one and treat pass/fail as the gate.

Add these when a real project demands them, not preemptively.

---
