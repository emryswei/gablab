# Ralph Task

## Goal
State the smallest behavior or quality outcome this loop must achieve.

## Known Facts
- Frontend:
- Backend:
- Database:
- Quality:

## Acceptance Criteria
- [ ] Behavior is covered by a deterministic check.
- [ ] `npm run quality` passes.
- [ ] `npm run build` passes when route/runtime behavior changes.
- [ ] Failure model coverage is still valid.

## Non-goals
- List work that must not be done in this loop.

## Failure Model Links
- Reference failure ids from `.agents/ralph/gablab-quality-loop/failure-model.json`.

## Verification Commands
```bash
npm run quality
npm run build
```

## Stop Conditions
- Stop after 5 failed iterations.
- Stop if the same classified failure repeats twice without a new hypothesis.
- Stop if required secrets, external accounts, or paid providers are missing.
- Stop before destructive git operations.
- Stop if the task requires product clarification.

## Refactor Rule
Refactor only after the behavior is protected and the relevant checks are green, unless the refactor is the smallest change required to make the failing test possible. Keep refactor commits or loop iterations separate from behavior changes when practical.

