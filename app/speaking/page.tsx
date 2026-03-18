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

      <section style={{ marginTop: 16 }}>
        <SpeakingCoach />
      </section>
    </main>
  );
}
