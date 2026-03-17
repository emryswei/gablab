import Link from "next/link";

import { Button } from "@/components/ui/button";
import SpeakingCoach from "./speaking-coach";

export default function SpeakingPage() {
  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: "0 16px", fontFamily: "sans-serif" }}>
      <div style={{ marginTop: 0 }}>
        <Button asChild variant="outline">
          <Link href="/">Back</Link>
        </Button>
      </div>
      <h1 style={{ marginTop: 16 }}>AI Speaking Practice</h1>
      <p style={{ marginTop: 8, color: "#4b5563" }}>
        Speak in English. The AI will correct and reply as a conversation partner in real time.
      </p>
      <section style={{ marginTop: 16 }}>
        <SpeakingCoach />
      </section>
    </main>
  );
}
