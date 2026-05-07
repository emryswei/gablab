---
agent: "codex"
commands:
  - name: failure_model
    run: npm run failure-model
  - name: tests
    run: npm test
  - name: smoke
    run: npm run smoke
  - name: lint
    run: npm run lint
  - name: typecheck
    run: npm run typecheck
  - name: build
    run: npm run build
args:
  - focus
---
# GabLab Ralph Loop

You are working in the GabLab Next.js App Router codebase.

Known facts:
- Frontend routes live under `app/`.
- Shared code lives under `lib/`, `components/`, and `scripts/`.
- Package management uses `npm`.
- Quality gates are deterministic commands listed in this file.
- Each failure-model item must map to concrete checks and failure classifications.

Derived loop rule:
Repeat small changes until the deterministic feedback is green. Do not treat a unit test pass as enough when lint, typecheck, or the failure model still reports risk.

Focus:
{{ args.focus }}

## Failure Model
{{ commands.failure_model }}

## Tests
{{ commands.tests }}

## Smoke
{{ commands.smoke }}

## Lint
{{ commands.lint }}

## Typecheck
{{ commands.typecheck }}

## Build
{{ commands.build }}

Each iteration:
1. Read the current failing signal.
2. Classify it as test, lint, typecheck, build, smoke, runtime, flaky, coverage, or requirement.
3. Write or adjust the smallest failing test/check that proves the behavior.
4. Implement the smallest production change.
5. Run the commands again.
6. If all checks pass, consider whether refactor is needed.
7. Record remaining risk before continuing.

Refactor rule:
- Refactor after behavior is protected and checks are green.
- Refactor during a red phase only when it is the smallest change needed to make the failing test possible.
- Keep refactor scope small and do not change behavior without an acceptance check.

Stop conditions:
- Stop after 5 failed iterations.
- Stop if the same classified failure repeats twice without a new hypothesis.
- Stop if a required secret, paid provider, database, or external account is missing.
- Stop before destructive git operations.
- Stop if acceptance criteria or product behavior are unclear.
