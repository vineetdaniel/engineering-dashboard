import { Pool, PoolClient, QueryResultRow } from "pg";
import { CREATE_ENUMS_SQL, CREATE_TABLES_SQL } from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Provide a database connection string via an environment variable."
  );
}

export const pool = new Pool({ connectionString });

let tablesEnsured = false;

export async function ensureTables(): Promise<void> {
  if (tablesEnsured) return;
  const client = await pool.connect();
  try {
    await client.query(CREATE_ENUMS_SQL);
    await client.query(CREATE_TABLES_SQL);
    tablesEnsured = true;
  } finally {
    client.release();
  }
}

export async function query<T extends QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  await ensureTables();
  const result = await pool.query<T>(text, params);
  return result.rows;
}

export async function queryOne<T extends QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] || null;
}

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  await ensureTables();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
