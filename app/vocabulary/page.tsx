import Link from "next/link";

import { getAdjacentWords, getRandomWord, getWord, type WordRow } from "@/lib/mysql";
import WordViewer from "./word-viewer";

export const dynamic = "force-dynamic";

type VocabularyPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function VocabularyPage({ searchParams }: VocabularyPageProps) {
  const resolvedSearchParams = await searchParams;
  const rawWord = resolvedSearchParams.word;
  const requestedWord = typeof rawWord === "string" ? rawWord : Array.isArray(rawWord) ? rawWord[0] : undefined;

  let currentWord: WordRow | null = null;
  let previousWord: WordRow | null = null;
  let nextWord: WordRow | null = null;
  let error: string | null = null;

  try {
    if (requestedWord) {
      currentWord = await getWord(requestedWord);
    }

    if (!currentWord) {
      currentWord = await getRandomWord();
    }

    if (currentWord) {
      const adjacent = await getAdjacentWords(currentWord.word);
      previousWord = adjacent.previous;
      nextWord = adjacent.next;
    }
  } catch (err) {
    error = err instanceof Error ? err.message : "Unknown MySQL error";
  }

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: "0 16px", fontFamily: "sans-serif" }}>
      <p style={{ marginTop: 0 }}>
        <Link href="/">Back</Link>
      </p>

      {error ? (
        <section
          style={{
            border: "1px solid #f1b7b7",
            background: "#fff5f5",
            borderRadius: 10,
            padding: 14,
            color: "#842029",
            marginTop: 20,
          }}
        >
          <strong>Database connection failed:</strong>
          <pre style={{ whiteSpace: "pre-wrap", margin: "8px 0 0" }}>{error}</pre>
        </section>
      ) : !currentWord ? (
        <section style={{ marginTop: 20 }}>
          <p>No words found in database.</p>
        </section>
      ) : (
        <section style={{ marginTop: 24 }}>
          <WordViewer currentWord={currentWord} previousWord={previousWord} nextWord={nextWord} />
        </section>
      )}
    </main>
  );
}
