import { ArrowRight, BookOpenText, Mic2 } from "lucide-react";
import Link from "next/link";

import LearningDashboard from "./learning-dashboard";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const modes = [
  {
    href: "/speaking",
    title: "Speaking",
    description: "Voice-first English and Cantonese practice with a live AI coach.",
    meta: ["English / 粤语", "Accent control", "Audio response"],
    icon: Mic2,
    variant: "speaking",
  },
  {
    href: "/vocabulary",
    title: "Vocabulary",
    description: "Review words through focused card navigation.",
    meta: ["Word cards", "Prev / Next", "Translation"],
    icon: BookOpenText,
    variant: "vocabulary",
  },
] as const;

export default function Home() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Language practice workspace</p>
        <h1>GabLab</h1>
        <p className={styles.subhead}>
          Build a consistent English speaking habit with guided practice and focused review.
        </p>
      </header>

      <LearningDashboard />

      <section className={styles.modeGrid} aria-label="Practice modes">
        {modes.map((mode) => {
          const Icon = mode.icon;
          return (
            <Link key={mode.href} href={mode.href} className={`${styles.modeCard} ${styles[mode.variant]}`}>
              <div className={styles.preview} aria-hidden="true">
                {mode.variant === "speaking" ? <VoicePreview /> : <CardPreview />}
              </div>
              <div className={styles.modeContent}>
                <span className={styles.iconBadge}>
                  <Icon size={18} strokeWidth={2.3} />
                </span>
                <h2>{mode.title}</h2>
                <p>{mode.description}</p>
                <div className={styles.metaRow}>
                  {mode.meta.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              </div>
              <span className={styles.arrow} aria-hidden="true">
                <ArrowRight size={18} strokeWidth={2.5} />
              </span>
            </Link>
          );
        })}
      </section>
    </main>
  );
}

function VoicePreview() {
  return (
    <div className={styles.voicePreview}>
      <span className={styles.voiceOuter} />
      <span className={styles.voiceMid} />
      <span className={styles.voiceCore} />
      <span className={styles.voiceBarOne} />
      <span className={styles.voiceBarTwo} />
    </div>
  );
}

function CardPreview() {
  return (
    <div className={styles.cardPreview}>
      <span className={styles.cardBack} />
      <span className={styles.cardMid} />
      <span className={styles.cardFront}>
        <strong>resilient</strong>
        <small>recover quickly</small>
      </span>
    </div>
  );
}
