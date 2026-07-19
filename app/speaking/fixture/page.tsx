import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import ControlledFixture from "./controlled-fixture";
import styles from "./page.module.css";

export default function SpeakingFixturePage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <main className={styles.page}>
      <div className={styles.topBar}>
        <Button asChild variant="outline" className={styles.backButton}>
          <Link href="/">Back</Link>
        </Button>
        <div className={styles.pageTitle}>
          <p>Browser workflow fixture</p>
          <h1>Lesson E2E</h1>
        </div>
      </div>
      <ControlledFixture />
    </main>
  );
}
