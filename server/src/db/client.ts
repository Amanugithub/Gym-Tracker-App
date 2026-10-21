import { Pool, type PoolClient, type QueryResultRow } from "pg";

export type Database = Pool;
export type Transaction = PoolClient;

export function createDatabase(connectionString: string): Pool {
  return new Pool({ connectionString });
}

export async function withTransaction<T>(
  pool: Pool,
  task: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await task(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function query<T extends QueryResultRow>(
  database: Pool | PoolClient,
  text: string,
  values: unknown[] = [],
): Promise<T[]> {
  const result = await database.query<T>(text, values);
  return result.rows;
}
