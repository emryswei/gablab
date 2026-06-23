import Link from "next/link";

import { Button } from "@/components/ui/button";
import BaselineAssessment from "./baseline-assessment";
import styles from "./page.module.css";

export default function BaselinePage() {
  return (
    <main className={styles.page}>
      <div className={styles.topBar}>
        <Button asChild variant="outline" className={styles.backButton}>
          <Link href="/">Back</Link>
        </Button>
        <div className={styles.pageTitle}>
          <p>English speaking profile</p>
          <h1>Baseline</h1>
        </div>
      </div>
      <BaselineAssessment />
    </main>
  );
}
