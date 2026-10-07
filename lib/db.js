import pg from 'pg';

const { Pool } = pg;

const globalForDb = globalThis;

export const db = globalForDb.__apparelflowPool || new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  max: 5
});

if (process.env.NODE_ENV !== 'production') globalForDb.__apparelflowPool = db;

export async function tx(work) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
