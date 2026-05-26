import { NextResponse } from "next/server";

import { SenseVoiceConfigurationError, transcribeCantonese } from "@/lib/speaking/stt/sensevoice";
import { decodePcm16Wav, WavFormatError } from "@/lib/speaking/stt/wav";

export const runtime = "nodejs";

const MAX_AUDIO_BYTES = 2 * 1024 * 1024;

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.startsWith("audio/wav")) {
    return NextResponse.json({ error: "Expected audio/wav body." }, { status: 415 });
  }

  const audio = await request.arrayBuffer();
  if (audio.byteLength === 0 || audio.byteLength > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "Audio must be between 1 byte and 2 MB." }, { status: 400 });
  }

  try {
    const waveform = decodePcm16Wav(audio);
    const text = await transcribeCantonese(waveform);
    return NextResponse.json({ text });
  } catch (error) {
    if (error instanceof WavFormatError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof SenseVoiceConfigurationError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("SenseVoice transcription failed.", error);
    return NextResponse.json({ error: "SenseVoice transcription failed." }, { status: 500 });
  }
}
