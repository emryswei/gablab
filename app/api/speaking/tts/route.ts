import { NextResponse } from "next/server";

import { createTtsFallback } from "@/lib/speaking/tts/fallback";

type TtsPayload = {
  text?: string;
};

function fallbackResponse(fallback: ReturnType<typeof createTtsFallback>) {
  return NextResponse.json(fallback, { status: 200, headers: { "X-TTS-Fallback": "1" } });
}

export async function POST(request: Request) {
  let payload: TtsPayload;
  try {
    payload = (await request.json()) as TtsPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const text = payload.text?.trim() ?? "";
  if (!text) {
    return NextResponse.json({ error: "Missing text." }, { status: 400 });
  }

  const configuredProvider = process.env.TTS_PROVIDER?.toLowerCase();
  const provider = configuredProvider ?? "openai";

  if (provider === "browser") {
    return fallbackResponse(createTtsFallback("browser_requested"));
  }

  if (provider !== "openai") {
    return fallbackResponse(createTtsFallback("unsupported_provider"));
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return fallbackResponse(createTtsFallback("missing_config"));
  }

  const model = process.env.OPENAI_TTS_MODEL ?? "gpt-4o-mini-tts";
  const voice = process.env.OPENAI_TTS_VOICE ?? "marin";
  const instructions =
    process.env.OPENAI_TTS_INSTRUCTIONS ??
    "Speak clearly with a neutral American English accent, natural intonation, and a friendly tutoring tone.";

  const ttsResponse = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      voice,
      input: text,
      instructions,
      format: "mp3",
    }),
  });

  if (!ttsResponse.ok) {
    await ttsResponse.text();
    return fallbackResponse(createTtsFallback("provider_unavailable"));
  }

  const audioBuffer = await ttsResponse.arrayBuffer();
  return new Response(audioBuffer, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}
