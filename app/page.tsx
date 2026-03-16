import Link from "next/link";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main
      style={{
        maxWidth: 900,
        margin: "40px auto",
        padding: "0 16px",
        fontFamily: "sans-serif",
      }}
    >
      <h1 style={{ marginBottom: 20 }}>GabLab</h1>
      <section
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        }}
      >
        <Link
          href="/speaking"
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: 160,
            border: "2px solid #1f2937",
            borderRadius: 14,
            fontSize: 32,
            fontWeight: 700,
            textDecoration: "none",
            color: "#111827",
            background: "#e5efff",
          }}
        >
          Speaking
        </Link>
        <Link
          href="/vocabulary"
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: 160,
            border: "2px solid #1f2937",
            borderRadius: 14,
            fontSize: 32,
            fontWeight: 700,
            textDecoration: "none",
            color: "#111827",
            background: "#eaf8eb",
          }}
        >
          Vocabulary
        </Link>
      </section>
    </main>
  );
}
