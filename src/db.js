import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });

export async function initializeDatabase() {
  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    console.log("✓ Database connected successfully");
  } catch (error) {
    console.error("✗ Failed to connect to database:", error);
    process.exit(1);
  }
}

export async function disconnectDatabase() {
  await pool.end();
  console.log("✓ Database disconnected");
}
