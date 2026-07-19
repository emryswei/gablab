import { createCoachResponse } from "../lib/speaking/coach/service.ts";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync } from "node:fs";

const SAMPLES = [
  {
    id: "english-past-tense",
    language: "english",
    utterance: "I go to the library yesterday.",
    modelContent: {
      reply: "That sounds productive.",
      corrected: "I went to the library yesterday.",
      feedback: "Use went for a completed action in the past.",
      followUpQuestion: "What did you do there?",
    },
    expectCorrection: true,
  },
  {
    id: "english-third-person",
    language: "english",
    utterance: "My brother work in a hospital.",
    modelContent: {
      reply: "Nice, healthcare work can be busy.",
      corrected: "My brother works in a hospital.",
      feedback: "Add s to the verb with he, she, or one person.",
      followUpQuestion: "What does he do at the hospital?",
    },
    expectCorrection: true,
  },
  {
    id: "english-article",
    language: "english",
    utterance: "I watched movie with my wife last night.",
    modelContent: {
      reply: "That sounds relaxing.",
      corrected: "I watched a movie with my wife last night.",
      feedback: "Use a before a singular countable noun like movie.",
      followUpQuestion: "What kind of movie was it?",
    },
    expectCorrection: true,
  },
  {
    id: "english-word-order",
    language: "english",
    utterance: "I very like this restaurant.",
    modelContent: {
      reply: "Good choice.",
      corrected: "I really like this restaurant.",
      feedback: "Say really like, not very like.",
      followUpQuestion: "What food do you usually order there?",
    },
    expectCorrection: true,
  },
  {
    id: "english-preposition",
    language: "english",
    utterance: "I arrived to the office at nine.",
    modelContent: {
      reply: "That is a clear daily routine.",
      corrected: "I arrived at the office at nine.",
      feedback: "Use arrive at for places like the office.",
      followUpQuestion: "What did you do first after arriving?",
    },
    expectCorrection: true,
  },
  {
    id: "english-natural-chat",
    language: "english",
    utterance: "I had coffee with my friend this morning.",
    modelContent: {
      reply: "That sounds like a nice start to the day.",
      corrected: null,
      feedback: null,
      followUpQuestion: "Where did you meet your friend?",
    },
    expectCorrection: false,
  },
  {
    id: "english-work-goal",
    language: "english",
    utterance: "I want to speak more confidently during international meetings.",
    modelContent: {
      reply: "That is a useful and realistic goal.",
      corrected: null,
      feedback: null,
      followUpQuestion: "What part of meetings feels hardest for you?",
    },
    expectCorrection: false,
  },
  {
    id: "english-family-routine",
    language: "english",
    utterance: "After work I usually cook dinner with my family.",
    modelContent: {
      reply: "That sounds like a good evening routine.",
      corrected: null,
      feedback: null,
      followUpQuestion: "What do you like cooking together?",
    },
    expectCorrection: false,
  },
  {
    id: "english-meeting-story",
    language: "english",
    utterance: "Last week I presented a new idea to my team.",
    modelContent: {
      reply: "That is a strong workplace example.",
      corrected: null,
      feedback: null,
      followUpQuestion: "How did your team respond?",
    },
    expectCorrection: false,
  },
  {
    id: "english-skip-question",
    language: "english",
    utterance: "",
    skipQuestion: true,
    modelContent: {
      reply: "No problem, let's try a different angle.",
      corrected: "Synthetic correction should be ignored.",
      feedback: "Synthetic feedback should be ignored.",
      followUpQuestion: "What do you usually do before work?",
    },
    expectCorrection: false,
  },
  {
    id: "cantonese-past-marker",
    language: "cantonese",
    utterance: "我尋日去超市買餸。",
    modelContent: {
      reply: "好貼近日常生活。",
      corrected: null,
      feedback: null,
      followUpQuestion: "你通常會買啲咩餸？",
    },
    expectCorrection: false,
  },
  {
    id: "cantonese-work-routine",
    language: "cantonese",
    utterance: "我朝早返工之前會飲杯咖啡。",
    modelContent: {
      reply: "呢個習慣幾常見。",
      corrected: null,
      feedback: null,
      followUpQuestion: "你飲咖啡之後會做咩先？",
    },
    expectCorrection: false,
  },
  {
    id: "cantonese-natural-chat",
    language: "cantonese",
    utterance: "我放工之後有時會同屋企人散步。",
    modelContent: {
      reply: "聽落好舒服。",
      corrected: null,
      feedback: null,
      followUpQuestion: "你哋通常去邊度行？",
    },
    expectCorrection: false,
  },
  {
    id: "cantonese-meeting-goal",
    language: "cantonese",
    utterance: "我想開會嗰陣講英文講得自然啲。",
    modelContent: {
      reply: "呢個目標好實用。",
      corrected: null,
      feedback: null,
      followUpQuestion: "你最想改善開場定回答問題？",
    },
    expectCorrection: false,
  },
  {
    id: "cantonese-mandarin-wording",
    language: "cantonese",
    utterance: "我昨天去了餐廳吃晚飯。",
    modelContent: {
      reply: "明白，你講緊食飯嘅經歷。",
      corrected: "我尋日去咗餐廳食晚飯。",
      feedback: "用尋日、去咗、食會更加似香港廣東話。",
      followUpQuestion: "嗰間餐廳有咩好食？",
    },
    expectCorrection: true,
  },
  {
    id: "cantonese-english-mixed",
    language: "cantonese",
    utterance: "我今日有一個meeting，所以有少少緊張。",
    modelContent: {
      reply: "開會前緊張好正常。",
      corrected: "我今日有個會，所以有少少緊張。",
      feedback: "如果想講得更地道，可以用有個會代替有一個meeting。",
      followUpQuestion: "你開會要講啲咩？",
    },
    expectCorrection: true,
  },
  {
    id: "cantonese-classifier",
    language: "cantonese",
    utterance: "我買了一咖啡。",
    modelContent: {
      reply: "買咖啡係好日常嘅話題。",
      corrected: "我買咗杯咖啡。",
      feedback: "廣東話通常會講買咗杯咖啡。",
      followUpQuestion: "你鍾意飲凍咖啡定熱咖啡？",
    },
    expectCorrection: true,
  },
  {
    id: "cantonese-negative",
    language: "cantonese",
    utterance: "我不想太早起身。",
    modelContent: {
      reply: "呢句好容易講得更自然。",
      corrected: "我唔想太早起身。",
      feedback: "口語廣東話一般用唔，少用不。",
      followUpQuestion: "你平時幾點起身？",
    },
    expectCorrection: true,
  },
  {
    id: "cantonese-aspect",
    language: "cantonese",
    utterance: "我食早餐然後返工。",
    modelContent: {
      reply: "呢個係清楚嘅早上流程。",
      corrected: "我食完早餐就返工。",
      feedback: "食完早餐就返工會令次序更自然。",
      followUpQuestion: "你早餐通常食啲咩？",
    },
    expectCorrection: true,
  },
  {
    id: "cantonese-skip-question",
    language: "cantonese",
    utterance: "",
    skipQuestion: true,
    modelContent: {
      reply: "冇問題，我哋轉另一條問題。",
      corrected: "呢句應該唔會出現。",
      feedback: "呢段回饋應該唔會出現。",
      followUpQuestion: "你放假通常會做啲咩？",
    },
    expectCorrection: false,
  },
];

const FIXTURE_ENV = {
  AI_PROVIDER: "cloudflare",
  CLOUDFLARE_ACCOUNT_ID: "eval-account",
  CLOUDFLARE_API_TOKEN: "eval-token",
};

function loadDotEnvLocal() {
  if (!existsSync(".env.local")) return;
  const lines = readFileSync(".env.local", "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

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
  return /[嘅咗喺唔冇嚟啦呀啲係佢嗰咩邊度呢]/.test(value);
}

function hasKnownBadCantoneseAdvice(sample, response) {
  const text = `${response.reply ?? ""} ${response.corrected ?? ""} ${response.feedback ?? ""} ${response.followUpQuestion ?? ""}`;
  return (
    (sample.utterance.includes("尋日") && text.includes("前日")) ||
    (sample.utterance.includes("有少少") && text.includes("有點")) ||
    (sample.utterance.includes("屋企人") && text.includes("家人"))
  );
}

function createFixtureFetch(samples) {
  const sampleByKey = new Map(samples.map((sample) => [sample.id, sample]));

  return async (_url, init) => {
    const body = JSON.parse(String(init?.body ?? "{}"));
    const userMessage = body.messages?.findLast?.((message) => message.role === "user")?.content ?? "";
    const systemMessage = body.messages?.find?.((message) => message.role === "system")?.content ?? "";
    const language = systemMessage.includes("Cantonese") ? "cantonese" : "english";
    const sample = [...sampleByKey.values()].find((entry) =>
      entry.language === language &&
      (entry.skipQuestion ? userMessage.includes("skip this question") : entry.utterance === userMessage),
    );

    if (!sample) {
      return Response.json({ error: "Unknown evaluation utterance." }, { status: 400 });
    }

    return Response.json({
      choices: [{ message: { content: JSON.stringify(sample.modelContent) } }],
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

  if (sample.expectCorrection && !hasText(response.feedback)) {
    errors.push("expected feedback");
  }

  if (sample.skipQuestion && (hasText(response.corrected) || hasText(response.feedback))) {
    errors.push("skip question returned correction or feedback");
  }

  if (sample.language === "english") {
    if (hasCjk(`${response.reply} ${response.followUpQuestion ?? ""} ${response.feedback ?? ""}`)) {
      errors.push("English response contains Chinese text");
    }
  } else {
    const visibleText = `${response.reply} ${response.followUpQuestion ?? ""} ${response.corrected ?? ""} ${response.feedback ?? ""}`;
    if (!hasCjk(visibleText)) {
      errors.push("Cantonese response has no Chinese text");
    }
    if (hasLatinLetter(`${response.reply} ${response.followUpQuestion ?? ""}`)) {
      errors.push("Cantonese reply switched to English");
    }
    if (!hasCantoneseMarker(visibleText)) {
      errors.push("Cantonese response does not look like spoken Hong Kong Cantonese");
    }
    if (hasKnownBadCantoneseAdvice(sample, response)) {
      errors.push("Cantonese response contains known bad advice");
    }
    if (sample.expectCorrection && response.corrected === sample.utterance) {
      errors.push("correction repeats the original utterance");
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
      skipQuestion: sample.skipQuestion,
    },
    options.env,
    options.fetchFn,
  );

  return {
    id: sample.id,
    language: sample.language,
    errors: validateResponse(sample, response),
    response,
  };
}

function printResult(result, verbose) {
  if (result.errors.length === 0) {
    console.log(`PASS ${result.id}`);
  } else {
    console.log(`FAIL ${result.id}`);
    for (const error of result.errors) {
      console.log(`  - ${error}`);
    }
  }

  if (verbose && !("error" in result.response)) {
    console.log(`  reply: ${result.response.reply}`);
    if (result.response.corrected) console.log(`  corrected: ${result.response.corrected}`);
    if (result.response.feedback) console.log(`  feedback: ${result.response.feedback}`);
    console.log(`  followUpQuestion: ${result.response.followUpQuestion ?? ""}`);
  }
}

export async function runSpeakingCoachEvaluation({ live = false } = {}) {
  if (live) loadDotEnvLocal();
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
  const verbose = process.argv.includes("--verbose");
  const results = await runSpeakingCoachEvaluation({ live });
  const failures = results.filter((result) => result.errors.length > 0);
  const english = results.filter((result) => result.language === "english");
  const cantonese = results.filter((result) => result.language === "cantonese");

  console.log(`Speaking coach evaluation (${live ? "live" : "fixture"})`);
  for (const result of results) {
    printResult(result, verbose);
  }

  console.log(
    `Summary: ${results.length - failures.length}/${results.length} passed ` +
      `(English ${english.filter((result) => result.errors.length === 0).length}/${english.length}, ` +
      `Cantonese ${cantonese.filter((result) => result.errors.length === 0).length}/${cantonese.length})`,
  );

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
