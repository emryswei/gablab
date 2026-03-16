import mysql from "mysql2/promise";

const requiredEnvVars = ["MYSQL_HOST", "MYSQL_USER", "MYSQL_PASSWORD", "MYSQL_DATABASE"] as const;

type RequiredEnvVar = (typeof requiredEnvVars)[number];

declare global {
  // Keep a singleton pool in dev to avoid exhausting connections during HMR.
  var mysqlPool: mysql.Pool | undefined;
}

function getMissingVars(): RequiredEnvVar[] {
  return requiredEnvVars.filter((key) => !process.env[key]);
}

export function getPool() {
  const missingVars = getMissingVars();
  if (missingVars.length > 0) {
    throw new Error(`Missing MySQL env vars: ${missingVars.join(", ")}`);
  }

  if (!global.mysqlPool) {
    global.mysqlPool = mysql.createPool({
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      port: Number(process.env.MYSQL_PORT ?? 3306),
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }

  return global.mysqlPool;
}

export type WordRow = {
  word: string;
  translation: string | null;
};

export async function listWords(limit = 50): Promise<WordRow[]> {
  const pool = getPool();
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(200, Math.floor(limit))) : 50;

  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    "SELECT word, translation FROM EnWords ORDER BY word ASC LIMIT ?",
    [safeLimit],
  );

  return rows as WordRow[];
}

export async function getWord(word: string): Promise<WordRow | null> {
  const pool = getPool();
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    "SELECT word, translation FROM EnWords WHERE word = ? LIMIT 1",
    [word],
  );

  return (rows[0] as WordRow | undefined) ?? null;
}

export async function getRandomWord(): Promise<WordRow | null> {
  const pool = getPool();
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    "SELECT word, translation FROM EnWords ORDER BY RAND() LIMIT 1",
  );

  return (rows[0] as WordRow | undefined) ?? null;
}

export async function getAdjacentWords(
  currentWord: string,
): Promise<{ previous: WordRow | null; next: WordRow | null }> {
  const pool = getPool();

  const [previousRows] = await pool.query<mysql.RowDataPacket[]>(
    "SELECT word, translation FROM EnWords WHERE word < ? ORDER BY word DESC LIMIT 1",
    [currentWord],
  );

  const [nextRows] = await pool.query<mysql.RowDataPacket[]>(
    "SELECT word, translation FROM EnWords WHERE word > ? ORDER BY word ASC LIMIT 1",
    [currentWord],
  );

  return {
    previous: (previousRows[0] as WordRow | undefined) ?? null,
    next: (nextRows[0] as WordRow | undefined) ?? null,
  };
}
