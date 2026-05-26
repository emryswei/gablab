import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getAdjacentWords, getRandomWord, getWord, type WordRow } from "@/lib/mysql";
import styles from "./page.module.css";
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
    <main className={styles.page}>
      <div className={styles.topBar}>
        <Button asChild variant="outline" className={styles.backButton}>
          <Link href="/">Back</Link>
        </Button>
        <div className={styles.pageTitle}>
          <p>Lexical memory deck</p>
          <h1>Vocabulary</h1>
        </div>
      </div>

      {error ? (
        <section className={styles.errorPanel}>
          <strong>Database connection failed:</strong>
          <pre>{error}</pre>
        </section>
      ) : !currentWord ? (
        <section className={styles.emptyPanel}>
          <p>No words found in database.</p>
        </section>
      ) : (
        <section className={styles.deckShell}>
          <WordViewer currentWord={currentWord} previousWord={previousWord} nextWord={nextWord} />
        </section>
      )}
    </main>
  );
}
