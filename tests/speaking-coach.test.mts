import test from "node:test";
import assert from "node:assert/strict";
import { buildCoachMessages, getRecentHistory } from "../lib/speaking/coach/messages.ts";
import { extractCoachReply } from "../lib/speaking/coach/response-parser.ts";
import { createCoachResponse } from "../lib/speaking/coach/service.ts";

test("extractCoachReply accepts JSON, fenced JSON, labels, and plain text", () => {
  assert.equal(extractCoachReply('{"coachReply":"Tell me more."}'), "Tell me more.");
  assert.equal(extractCoachReply('```json\n{"coachReply":"What happened next?"}\n```'), "What happened next?");
  assert.equal(extractCoachReply("Coach reply: How did you feel?"), "How did you feel?");
  assert.equal(extractCoachReply("Corrected: I went home\nFeedback: good\nNice work."), "Nice work.");
});

test("getRecentHistory keeps only valid recent chat turns", () => {
  const history = [
    { role: "user", content: "one" },
    { role: "system", content: "invalid" },
    { role: "assistant", content: "" },
    { role: "assistant", content: "two" },
  ];

  assert.deepEqual(getRecentHistory(history), [
    { role: "user", content: "one" },
    { role: "assistant", content: "two" },
  ]);
});

test("buildCoachMessages trims history and appends the current utterance", () => {
  const messages = buildCoachMessages(" I like coffee. ", [{ role: "user", content: " hello " }]);

  assert.equal(messages[0].role, "system");
  assert.deepEqual(messages.slice(1), [
    { role: "user", content: "hello" },
    { role: "user", content: " I like coffee. " },
  ]);
});

test("createCoachResponse rejects missing utterance before provider call", async () => {
  let called = false;
  const response = await createCoachResponse({}, {}, async () => {
    called = true;
    return new Response();
  });

  assert.equal(called, false);
  assert.deepEqual(response, { error: "Missing utterance.", status: 400 });
});

test("createCoachResponse uses OpenAI by default and normalizes coach reply", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const response = await createCoachResponse(
    { utterance: "Hello" },
    { OPENAI_API_KEY: "test-key" },
    async (url, init) => {
      calls.push({ url: String(url), init });
      return Response.json({ choices: [{ message: { content: '{"coachReply":"Hi. How are you?"}' } }] });
    },
  );

  assert.equal(calls[0]?.url, "https://api.openai.com/v1/chat/completions");
  assert.deepEqual(response, {
    corrected: "Hello",
    feedback: "Good effort. Keep sentences short and clear.",
    coachReply: "Hi. How are you?",
  });
});

test("createCoachResponse can route to Cloudflare provider", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const response = await createCoachResponse(
    { utterance: "Hello" },
    {
      AI_PROVIDER: "cloudflare",
      CLOUDFLARE_ACCOUNT_ID: "account",
      CLOUDFLARE_API_TOKEN: "token",
    },
    async (url, init) => {
      calls.push({ url: String(url), init });
      return Response.json({ choices: [{ message: { content: "Coach reply: Nice. What did you do today?" } }] });
    },
  );

  assert.equal(calls[0]?.url, "https://api.cloudflare.com/client/v4/accounts/account/ai/v1/chat/completions");
  assert.deepEqual(response, {
    corrected: "Hello",
    feedback: "Good effort. Keep sentences short and clear.",
    coachReply: "Nice. What did you do today?",
  });
});

