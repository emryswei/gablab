import Link from "next/link";

import { Button } from "@/components/ui/button";
import styles from "./page.module.css";
import SpeakingCoach from "./speaking-coach";

export default function SpeakingPage() {
  return (
    <main className={styles.page}>
      <div className={styles.topBar}>
        <Button asChild variant="outline" className={styles.backButton}>
          <Link href="/">Back</Link>
        </Button>
        <div className={styles.pageTitle}>
          <p>Live neural voice lab</p>
          <h1>Speaking</h1>
        </div>
      </div>

      <section className={styles.practiceShell}>
        <SpeakingCoach />
      </section>
    </main>
  );
}
