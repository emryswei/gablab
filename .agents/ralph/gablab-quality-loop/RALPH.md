---
agent: "codex"
commands:
  - name: failure_model
    run: npm run failure-model
  - name: tests
    run: npm test
  - name: lint
    run: npm run lint
  - name: typecheck
    run: npm run typecheck
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

Derived loop rule:
Repeat small changes until the deterministic feedback is green. Do not treat a unit test pass as enough when lint, typecheck, or the failure model still reports risk.

Focus:
{{ args.focus }}

## Failure Model
{{ commands.failure_model }}

## Tests
{{ commands.tests }}

## Lint
{{ commands.lint }}

## Typecheck
{{ commands.typecheck }}

Each iteration:
1. Read the current failing signal.
2. Write or adjust the smallest failing test that proves the behavior.
3. Implement the smallest production change.
4. Run the commands again.
5. Record remaining risk before continuing.

