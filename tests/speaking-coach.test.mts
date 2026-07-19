import test from "node:test";
import assert from "node:assert/strict";
import { buildCoachMessages, getRecentHistory } from "../lib/speaking/coach/messages.ts";
import { extractCoachReply } from "../lib/speaking/coach/response-parser.ts";
import { createCoachResponse } from "../lib/speaking/coach/service.ts";

test("extractCoachReply accepts JSON, fenced JSON, labels, and plain text", () => {
  assert.equal(extractCoachReply('{"reply":"That sounds interesting."}'), "That sounds interesting.");
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
  assert.match(messages[0].content, /JSON object/);
  assert.match(messages[0].content, /followUpQuestion/);
  assert.deepEqual(messages.slice(1), [
    { role: "user", content: "hello" },
    { role: "user", content: " I like coffee. " },
  ]);
});

test("buildCoachMessages requests Traditional Cantonese replies for Cantonese mode", () => {
  const messages = buildCoachMessages("今日好熱呀", [], "cantonese");

  assert.match(messages[0].content, /Traditional Cantonese/);
  assert.match(messages[0].content, /Hong Kong spoken Cantonese/);
});

test("buildCoachMessages includes structured lesson checkpoints", async () => {
  const { INTRODUCING_YOURSELF_LESSON } = await import("../lib/learning/courses.ts");
  const messages = buildCoachMessages(
    "I work in an office.",
    [],
    "english",
    INTRODUCING_YOURSELF_LESSON,
  );

  assert.match(messages[0].content, /Introducing Yourself and Daily Life/);
  assert.match(messages[0].content, /Typical day/);
  assert.match(messages[0].content, /adaptive follow-up questions/);
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

test("createCoachResponse uses OpenAI by default and returns structured coaching fields", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const response = await createCoachResponse(
    { utterance: "I go home yesterday." },
    { OPENAI_API_KEY: "test-key" },
    async (url, init) => {
      calls.push({ url: String(url), init });
      return Response.json({
        choices: [{
          message: {
            content: '{"reply":"Sounds like a quiet day.","corrected":"I went home yesterday.","feedback":"Use went for a completed action in the past.","followUpQuestion":"What did you do at home?"}',
          },
        }],
      });
    },
  );

  assert.equal(calls[0]?.url, "https://api.openai.com/v1/chat/completions");
  assert.deepEqual(response, {
    reply: "Sounds like a quiet day.",
    corrected: "I went home yesterday.",
    feedback: "Use went for a completed action in the past.",
    followUpQuestion: "What did you do at home?",
    coachReply: "Sounds like a quiet day. What did you do at home?",
  });
});

test("createCoachResponse uses Qwen on Cloudflare and omits unneeded correction fields", async () => {
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
      return Response.json({
        choices: [{
          message: {
            content: '{"reply":"Nice.","corrected":null,"feedback":null,"followUpQuestion":"What did you do today?"}',
          },
        }],
      });
    },
  );

  assert.equal(calls[0]?.url, "https://api.cloudflare.com/client/v4/accounts/account/ai/v1/chat/completions");
  const requestBody = JSON.parse(String(calls[0]?.init?.body)) as {
    model: string;
    response_format: { type: string };
  };
  assert.equal(requestBody.model, "@cf/qwen/qwen3-30b-a3b-fp8");
  assert.deepEqual(requestBody.response_format, { type: "json_object" });
  assert.deepEqual(response, {
    reply: "Nice.",
    followUpQuestion: "What did you do today?",
    coachReply: "Nice. What did you do today?",
  });
});

test("createCoachResponse forwards Cantonese conversation instructions", async () => {
  let sentMessages: Array<{ role: string; content: string }> = [];
  const response = await createCoachResponse(
    { utterance: "我今日去咗飲茶", language: "cantonese" },
    { OPENAI_API_KEY: "test-key" },
    async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as { messages: Array<{ role: string; content: string }> };
      sentMessages = body.messages;
      return Response.json({
        choices: [{
          message: {
            content: '{"reply":"幾好喎。","corrected":null,"feedback":null,"followUpQuestion":"你食咗啲咩？"}',
          },
        }],
      });
    },
  );

  assert.match(sentMessages[0].content, /Traditional Cantonese/);
  assert.equal("error" in response, false);
  if (!("error" in response)) {
    assert.equal(response.reply, "幾好喎。");
    assert.equal(response.followUpQuestion, "你食咗啲咩？");
    assert.equal(response.coachReply, "幾好喎。 你食咗啲咩？");
  }
});

test("createCoachResponse suppresses over-correction for natural Cantonese", async () => {
  const response = await createCoachResponse(
    { utterance: "我放工之後有時會同屋企人散步。", language: "cantonese" },
    { OPENAI_API_KEY: "test-key" },
    async () =>
      Response.json({
        choices: [{
          message: {
            content: JSON.stringify({
              reply: "唔錯呀。",
              corrected: "我放工之後有時會同家人散步。",
              feedback: "家人比較正式。",
              followUpQuestion: "你哋通常去邊度行？",
            }),
          },
        }],
      }),
  );

  assert.equal("error" in response, false);
  if (!("error" in response)) {
    assert.equal(response.corrected, undefined);
    assert.equal(response.feedback, undefined);
    assert.equal(response.followUpQuestion, "你哋通常去邊度行？");
  }
});

test("createCoachResponse fills clear Cantonese code-switch correction when model misses it", async () => {
  const response = await createCoachResponse(
    { utterance: "我今日有一個meeting，所以有少少緊張。", language: "cantonese" },
    { OPENAI_API_KEY: "test-key" },
    async () =>
      Response.json({
        choices: [{
          message: {
            content: JSON.stringify({
              reply: "明白。",
              corrected: null,
              feedback: null,
              followUpQuestion: "你開會要講啲咩？",
            }),
          },
        }],
      }),
  );

  assert.equal("error" in response, false);
  if (!("error" in response)) {
    assert.equal(response.corrected, "我今日有個會，所以有少少緊張。");
    assert.match(response.feedback ?? "", /meeting/);
  }
});

test("createCoachResponse fills clear Cantonese negative correction when model misses it", async () => {
  const response = await createCoachResponse(
    { utterance: "我不想太早起身。", language: "cantonese" },
    { OPENAI_API_KEY: "test-key" },
    async () =>
      Response.json({
        choices: [{
          message: {
            content: JSON.stringify({
              reply: "明白。",
              corrected: null,
              feedback: null,
              followUpQuestion: "你平時幾點起身？",
            }),
          },
        }],
      }),
  );

  assert.equal("error" in response, false);
  if (!("error" in response)) {
    assert.equal(response.corrected, "我唔想太早起身。");
    assert.match(response.feedback ?? "", /唔/);
  }
});

test("createCoachResponse rejects known bad Cantonese advice", async () => {
  const response = await createCoachResponse(
    { utterance: "我尋日去超市買餸。", language: "cantonese" },
    { OPENAI_API_KEY: "test-key" },
    async () =>
      Response.json({
        choices: [{
          message: {
            content: JSON.stringify({
              reply: "明白。",
              corrected: "我前日去超市買餸。",
              feedback: "用前日會自然啲。",
              followUpQuestion: "你買咗啲咩餸？",
            }),
          },
        }],
      }),
  );

  assert.equal("error" in response, false);
  if (!("error" in response)) {
    assert.equal(response.corrected, undefined);
    assert.equal(response.feedback, undefined);
  }
});

test("createCoachResponse replaces English follow-up in Cantonese mode", async () => {
  const response = await createCoachResponse(
    { utterance: "我今日有一個meeting，所以有少少緊張。", language: "cantonese" },
    { OPENAI_API_KEY: "test-key" },
    async () =>
      Response.json({
        choices: [{
          message: {
            content: JSON.stringify({
              reply: "明白。",
              corrected: "我今日有個會，所以有少少緊張。",
              feedback: "meeting 可以講成會。",
              followUpQuestion: "What will you talk about in the meeting?",
            }),
          },
        }],
      }),
  );

  assert.equal("error" in response, false);
  if (!("error" in response)) {
    assert.equal(response.followUpQuestion, "你可以講多少少嗎？");
    assert.equal(/[A-Za-z]/.test(response.coachReply), false);
  }
});

test("createCoachResponse skips to another checkpoint without returning correction feedback", async () => {
  let finalUserMessage = "";
  const response = await createCoachResponse(
    {
      lessonId: "introducing-yourself-and-daily-life",
      language: "english",
      skipQuestion: true,
    },
    { OPENAI_API_KEY: "test-key" },
    async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as { messages: Array<{ role: string; content: string }> };
      finalUserMessage = body.messages.at(-1)?.content ?? "";
      return Response.json({
        choices: [{
          message: {
            content: '{"reply":"No problem.","corrected":"Incorrect synthetic correction.","feedback":"Synthetic feedback.","followUpQuestion":"What do you enjoy doing after work?"}',
          },
        }],
      });
    },
  );

  assert.match(finalUserMessage, /skip this question/);
  assert.equal("error" in response, false);
  if (!("error" in response)) {
    assert.equal(response.corrected, undefined);
    assert.equal(response.feedback, undefined);
    assert.equal(response.followUpQuestion, "What do you enjoy doing after work?");
  }
});

