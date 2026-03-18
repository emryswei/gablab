import { NextResponse } from "next/server";

type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

type CoachPayload = {
  utterance?: string;
  history?: ChatTurn[];
};

type OpenAIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type CompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

type ParsedCoach = {
  corrected?: string;
  feedback?: string | string[];
  coachReply?: string;
};

function parseCoachContent(rawContent: string): ParsedCoach | null {
  try {
    return JSON.parse(rawContent) as ParsedCoach;
  } catch {
    // fall through
  }

  const firstBrace = rawContent.indexOf("{");
  const lastBrace = rawContent.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  const jsonSlice = rawContent.slice(firstBrace, lastBrace + 1);
  try {
    return JSON.parse(jsonSlice) as ParsedCoach;
  } catch {
    return null;
  }
}

function normalizeFeedback(feedback: ParsedCoach["feedback"]) {
  if (Array.isArray(feedback)) {
    return feedback.filter(Boolean).join(" ");
  }
  if (typeof feedback === "string") {
    return feedback;
  }
  return "Good effort. Keep sentences short and clear.";
}

function extractCoachReply(rawContent: string) {
  const trimmed = rawContent.trim();

  // 1) JSON or JSON-like response
  const parsed = parseCoachContent(trimmed);
  if (parsed?.coachReply && typeof parsed.coachReply === "string") {
    return parsed.coachReply.trim();
  }

  // 2) Markdown fenced JSON/text
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch?.[1]) {
    const fromFence = fenceMatch[1].trim();
    const parsedFence = parseCoachContent(fromFence);
    if (parsedFence?.coachReply && typeof parsedFence.coachReply === "string") {
      return parsedFence.coachReply.trim();
    }
  }

  // 3) Label-based outputs
  const lineMatch = trimmed.match(/coach\s*reply\s*:\s*([\s\S]*)/i);
  if (lineMatch?.[1]) {
    return lineMatch[1].trim();
  }

  // 4) If model sends multiple labeled fields, remove corrected/feedback headers from visible text.
  return trimmed
    .replace(/^\s*json response\s*:\s*/i, "")
    .replace(/^\s*corrected\s*:\s*.*$/gim, "")
    .replace(/^\s*feedback\s*:\s*.*$/gim, "")
    .trim();
}

async function requestOpenAI(messages: OpenAIMessage[]) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { error: "Missing OPENAI_API_KEY in environment variables.", status: 500 as const };
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.6,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    return { error: `OpenAI request failed (${response.status}): ${text}`, status: 502 as const };
  }

  const completion = (await response.json()) as CompletionResponse;
  const content = completion.choices?.[0]?.message?.content;
  if (!content) {
    return { error: "Empty model response.", status: 502 as const };
  }

  return { content };
}

async function requestCloudflare(messages: OpenAIMessage[]) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) {
    return {
      error: "Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN in environment variables.",
      status: 500 as const,
    };
  }

  const model = process.env.CLOUDFLARE_MODEL ?? "@cf/meta/llama-3.1-8b-instruct";
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.6,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    return { error: `Cloudflare request failed (${response.status}): ${text}`, status: 502 as const };
  }

  const completion = (await response.json()) as CompletionResponse;
  const content = completion.choices?.[0]?.message?.content;
  if (!content) {
    return { error: "Empty model response.", status: 502 as const };
  }

  return { content };
}

export async function POST(request: Request) {
  let payload: CoachPayload;
  try {
    payload = (await request.json()) as CoachPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const utterance = payload.utterance?.trim() ?? "";
  if (!utterance) {
    return NextResponse.json({ error: "Missing utterance." }, { status: 400 });
  }

  const recentHistory = (payload.history ?? []).slice(-8);

  const messages: OpenAIMessage[] = [
    {
      role: "system",
      content:
        "You are an English-speaking coach. Return only one short conversational reply in plain text with one follow-up question. Do not return JSON. Do not include labels like corrected, feedback, or coachReply. Keep CEFR A2-B2 friendly.",
    },
    ...recentHistory.map((turn) => ({
      role: turn.role,
      content: turn.content,
    })),
    {
      role: "user",
      content: utterance,
    },
  ];

  const provider = (process.env.AI_PROVIDER ?? "openai").toLowerCase();
  const modelResponse =
    provider === "cloudflare" ? await requestCloudflare(messages) : await requestOpenAI(messages);

  if ("error" in modelResponse) {
    return NextResponse.json({ error: modelResponse.error }, { status: modelResponse.status });
  }

  const coachReply = extractCoachReply(modelResponse.content) || "Nice try. Can you tell me more?";
  return NextResponse.json({
    corrected: utterance,
    feedback: normalizeFeedback(undefined),
    coachReply,
  });
}
