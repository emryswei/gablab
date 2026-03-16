import { NextResponse } from "next/server";

import { getAdjacentWords, getRandomWord, getWord } from "@/lib/mysql";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const word = searchParams.get("word");

  try {
    const currentWord = word ? await getWord(word) : await getRandomWord();

    if (!currentWord) {
      return NextResponse.json({ error: "No words found in database." }, { status: 404 });
    }

    const { previous, next } = await getAdjacentWords(currentWord.word);

    return NextResponse.json({
      currentWord,
      previousWord: previous,
      nextWord: next,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown MySQL error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
