import { Pool, PoolClient, QueryResultRow } from "pg";
import { CREATE_ENUMS_SQL, CREATE_TABLES_SQL } from "./schema";

let pool: Pool | null = null;
let tablesEnsured = false;

function getPool(): Pool {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    // Defer the hard error until a query actually runs. This lets Next.js
    // build static pages that import this module without DATABASE_URL being
    // set at compile time.
    throw new Error(
      "DATABASE_URL is not set. Provide a database connection string via an environment variable."
    );
  }
  pool = new Pool({ connectionString });
  return pool;
}

export async function ensureTables(): Promise<void> {
  if (tablesEnsured) return;
  const client = await getPool().connect();
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
  const result = await getPool().query<T>(text, params);
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
  const client = await getPool().connect();
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
