import Link from "next/link";

import { Button } from "@/components/ui/button";
import styles from "../page.module.css";
import ReviewQueue from "../review-queue";

export default function VocabularyReviewPage() {
  return (
    <main className={styles.page}>
      <div className={styles.topBar}>
        <Button asChild variant="outline" className={styles.backButton}>
          <Link href="/">Back</Link>
        </Button>
        <div className={styles.pageTitle}>
          <p>Spaced repetition</p>
          <h1>Lesson Review</h1>
        </div>
      </div>

      <ReviewQueue />
    </main>
  );
}
