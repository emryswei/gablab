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
  feedback?: string;
  coachReply?: string;
};

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
        "You are an English-speaking coach. Return strict JSON with keys corrected, feedback, coachReply. corrected: natural corrected version of user's sentence. feedback: 1-2 short tips. coachReply: concise conversational reply with one follow-up question. Keep CEFR A2-B2 friendly.",
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

  try {
    const parsed = JSON.parse(modelResponse.content) as ParsedCoach;

    return NextResponse.json({
      corrected: parsed.corrected ?? utterance,
      feedback: parsed.feedback ?? "Good effort. Keep sentences short and clear.",
      coachReply: parsed.coachReply ?? "Nice try. Can you tell me more?",
    });
  } catch {
    return NextResponse.json({
      corrected: utterance,
      feedback: "Good effort. Keep practicing your speaking fluency.",
      coachReply: modelResponse.content,
    });
  }
}
