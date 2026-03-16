import Link from "next/link";

export default function SpeakingPage() {
  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: "0 16px", fontFamily: "sans-serif" }}>
      <p style={{ marginTop: 0 }}>
        <Link href="/">Back</Link>
      </p>
      <h1>Welcome to speaking page</h1>
    </main>
  );
}
