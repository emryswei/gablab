import test from "node:test";
import assert from "node:assert/strict";
import { createTtsFallback } from "../lib/speaking/tts/fallback.ts";

test("createTtsFallback returns stable browser fallback payloads", () => {
  assert.deepEqual(createTtsFallback("browser_requested"), {
    fallback: true,
    code: "browser_requested",
    reason: "Premium voice is unavailable. Using browser voice instead.",
  });
});
