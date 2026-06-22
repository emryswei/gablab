import { createCoachResponse } from "../lib/speaking/coach/service.ts";
import { fileURLToPath } from "node:url";

const SAMPLES = [
  {
    id: "english-past-tense",
    language: "english",
    utterance: "I go to the library yesterday.",
    modelContent: JSON.stringify({
      reply: "That sounds productive.",
      corrected: "I went to the library yesterday.",
      feedback: "Use went for a completed action in the past.",
      followUpQuestion: "What did you do there?",
    }),
    expectCorrection: true,
    expectFeedback: true,
  },
  {
    id: "english-natural-chat",
    language: "english",
    utterance: "I had coffee with my friend this morning.",
    modelContent: JSON.stringify({
      reply: "That sounds like a nice start to the day.",
      corrected: null,
      feedback: null,
      followUpQuestion: "Where did you meet your friend?",
    }),
    expectCorrection: false,
    expectFeedback: false,
  },
  {
    id: "cantonese-naturalization",
    language: "cantonese",
    utterance: "我今天去了吃飯",
    modelContent: JSON.stringify({
      reply: "明白，你係講去食飯。",
      corrected: "我今日去咗食飯。",
      feedback: "廣東話口語通常會講「今日」同「去咗」。",
      followUpQuestion: "你食咗啲咩？",
    }),
    expectCorrection: true,
    expectFeedback: true,
  },
  {
    id: "cantonese-natural-chat",
    language: "cantonese",
    utterance: "我今日去咗飲茶",
    modelContent: JSON.stringify({
      reply: "幾好喎，飲茶好舒服。",
      corrected: null,
      feedback: null,
      followUpQuestion: "你最鍾意食邊款點心？",
    }),
    expectCorrection: false,
    expectFeedback: false,
  },
];

const FIXTURE_ENV = {
  AI_PROVIDER: "cloudflare",
  CLOUDFLARE_ACCOUNT_ID: "eval-account",
  CLOUDFLARE_API_TOKEN: "eval-token",
};

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasCjk(value) {
  return /[\u3400-\u9fff]/.test(value);
}

function hasLatinLetter(value) {
  return /[A-Za-z]/.test(value);
}

function hasCantoneseMarker(value) {
  return /[嘅咗啲唔冇喺佢哋嚟嚿]/.test(value);
}

function createFixtureFetch(samples) {
  const sampleByUtterance = new Map(samples.map((sample) => [sample.utterance, sample]));

  return async (_url, init) => {
    const body = JSON.parse(String(init?.body ?? "{}"));
    const utterance = body.messages?.findLast?.((message) => message.role === "user")?.content;
    const sample = sampleByUtterance.get(utterance);

    if (!sample) {
      return Response.json({ error: "Unknown evaluation utterance." }, { status: 400 });
    }

    return Response.json({
      choices: [{ message: { content: sample.modelContent } }],
    });
  };
}

function validateResponse(sample, response) {
  const errors = [];

  if ("error" in response) {
    return [`provider error: ${response.error}`];
  }

  if (!hasText(response.reply)) {
    errors.push("missing reply");
  }

  if (!hasText(response.followUpQuestion)) {
    errors.push("missing followUpQuestion");
  }

  if (!hasText(response.coachReply) || !response.coachReply.includes(response.reply)) {
    errors.push("coachReply does not include reply");
  }

  if (hasText(response.followUpQuestion) && !response.coachReply.includes(response.followUpQuestion)) {
    errors.push("coachReply does not include followUpQuestion");
  }

  if (sample.expectCorrection && !hasText(response.corrected)) {
    errors.push("expected correction");
  }

  if (!sample.expectCorrection && hasText(response.corrected)) {
    errors.push("unexpected correction");
  }

  if (sample.expectFeedback && !hasText(response.feedback)) {
    errors.push("expected feedback");
  }

  if (!sample.expectFeedback && hasText(response.feedback)) {
    errors.push("unexpected feedback");
  }

  if (sample.language === "english") {
    if (hasCjk(`${response.reply} ${response.followUpQuestion ?? ""}`)) {
      errors.push("English response contains Chinese text");
    }
  } else {
    const visibleText = `${response.reply} ${response.followUpQuestion ?? ""} ${response.corrected ?? ""}`;
    if (!hasCjk(visibleText)) {
      errors.push("Cantonese response has no Chinese text");
    }
    if (hasLatinLetter(`${response.reply} ${response.followUpQuestion ?? ""}`)) {
      errors.push("Cantonese reply switched to English");
    }
    if (sample.expectCorrection && !hasCantoneseMarker(response.corrected ?? "")) {
      errors.push("Cantonese correction does not look conversational");
    }
  }

  return errors;
}

async function evaluateSample(sample, options) {
  const response = await createCoachResponse(
    {
      utterance: sample.utterance,
      language: sample.language,
      history: [],
    },
    options.env,
    options.fetchFn,
  );

  return {
    id: sample.id,
    errors: validateResponse(sample, response),
    response,
  };
}

function printResult(result) {
  if (result.errors.length === 0) {
    console.log(`PASS ${result.id}`);
    return;
  }

  console.log(`FAIL ${result.id}`);
  for (const error of result.errors) {
    console.log(`  - ${error}`);
  }
}

export async function runSpeakingCoachEvaluation({ live = false } = {}) {
  const fetchFn = live ? fetch : createFixtureFetch(SAMPLES);
  const env = live ? process.env : FIXTURE_ENV;
  const results = [];

  for (const sample of SAMPLES) {
    results.push(await evaluateSample(sample, { env, fetchFn }));
  }

  return results;
}

async function main() {
  const live = process.argv.includes("--live");
  const results = await runSpeakingCoachEvaluation({ live });
  const failures = results.filter((result) => result.errors.length > 0);

  console.log(`Speaking coach evaluation (${live ? "live" : "fixture"})`);
  for (const result of results) {
    printResult(result);
  }

  console.log(`Summary: ${results.length - failures.length}/${results.length} passed`);

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
