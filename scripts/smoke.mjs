import assert from "node:assert/strict";
import { createCoachResponse } from "../lib/speaking/coach/service.ts";
import { createTtsFallback } from "../lib/speaking/tts/fallback.ts";

async function testCoachMissingUtterance() {
  let providerCalled = false;
  const result = await createCoachResponse({}, {}, async () => {
    providerCalled = true;
    return Response.json({});
  });

  assert.equal(providerCalled, false);
  assert.deepEqual(result, { error: "Missing utterance.", status: 400 });
}

async function testTtsBrowserFallback() {
  assert.deepEqual(createTtsFallback("browser_requested"), {
    fallback: true,
    code: "browser_requested",
    reason: "Premium voice is unavailable. Using browser voice instead.",
  });
}

async function main() {
  await testCoachMissingUtterance();
  await testTtsBrowserFallback();
  console.log("Smoke checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
