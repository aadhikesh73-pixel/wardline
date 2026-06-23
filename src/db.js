import 'dotenv/config'
import pg from 'pg'

const { Pool } = pg

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is not set.')
  console.error('Copy server/.env.example to server/.env and fill in your Neon connection string.')
  process.exit(1)
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Neon requires SSL in production; locally (without SSL) we skip it.
  ssl: process.env.DATABASE_URL.includes('sslmode=require') ||
       process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
})

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err)
})

// Helper: run a query with parameters and return all rows.
// Uses $1 $2 ... placeholders (PostgreSQL style).
export async function query(text, params) {
  const { rows } = await pool.query(text, params)
  return rows
}

// Helper: run a query and return only the first row (or null).
export async function queryOne(text, params) {
  const { rows } = await pool.query(text, params)
  return rows[0] ?? null
}

// Helper: wrap multiple queries in a transaction.
// Pass a callback that receives a client and returns a value.
export async function transaction(fn) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

export default pool
