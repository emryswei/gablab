import test from "node:test";
import assert from "node:assert/strict";
import { validateFailureModel } from "../scripts/failure-model.mjs";

test("validateFailureModel requires coverage across frontend, backend, database, and quality", () => {
  const result = validateFailureModel({
    failures: [
      {
        id: "front-1",
        layer: "frontend",
        risk: "UI state lies to the user.",
        signal: "Manual review or browser behavior shows stale state.",
        detection: "Component and browser checks.",
        response: "Fix state ownership.",
        checks: ["npm test"],
        classifications: ["test"],
      },
      {
        id: "api-1",
        layer: "backend",
        risk: "API accepts bad input.",
        signal: "Invalid request succeeds.",
        detection: "Route validation tests.",
        response: "Reject with typed errors.",
        checks: ["npm run smoke"],
        classifications: ["smoke"],
      },
      {
        id: "data-1",
        layer: "database",
        risk: "Database query returns wrong boundary rows.",
        signal: "Adjacent data is inconsistent.",
        detection: "Query contract tests or seeded checks.",
        response: "Patch query and seed regression.",
        checks: ["npm test"],
        classifications: ["runtime"],
      },
      {
        id: "quality-1",
        layer: "quality",
        risk: "A change passes unit tests but fails integration quality.",
        signal: "Lint, typecheck, build, or failure model gate fails.",
        detection: "npm run quality.",
        response: "Fix the failing gate before continuing.",
        checks: ["npm run quality"],
        classifications: ["lint", "typecheck", "build"],
      },
    ],
  });

  assert.deepEqual(result, { ok: true, errors: [] });
});

test("validateFailureModel rejects duplicate ids and missing layer coverage", () => {
  const result = validateFailureModel({
    failures: [
      {
        id: "same",
        layer: "frontend",
        risk: "A",
        signal: "B",
        detection: "C",
        response: "D",
        checks: ["npm test"],
        classifications: ["test"],
      },
      {
        id: "same",
        layer: "frontend",
        risk: "A",
        signal: "B",
        detection: "C",
        response: "D",
        checks: ["npm test"],
        classifications: ["test"],
      },
    ],
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /duplicate failure id: same/);
  assert.match(result.errors.join("\n"), /failure model must cover backend/);
});
