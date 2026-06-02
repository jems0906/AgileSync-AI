import fs from "fs/promises";
import path from "path";
import pg from "pg";
import { fileURLToPath } from "url";
import { config } from "../config.js";

let pool = null;
let initialized = false;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (config.databaseUrl) {
  pool = new pg.Pool({ connectionString: config.databaseUrl });
}

async function runSchema() {
  if (!pool || initialized) {
    return;
  }

  const schemaPath = path.join(__dirname, "schema.sql");
  const schema = await fs.readFile(schemaPath, "utf8");
  const statements = schema
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await pool.query(statement);
  }

  initialized = true;
}

export const db = {
  enabled: Boolean(pool),
  async query(text, params = []) {
    if (!pool) {
      throw new Error("Database not configured");
    }
    return pool.query(text, params);
  },
  async close() {
    if (pool) {
      await pool.end();
    }
  }
};

export async function initializeDatabase() {
  if (!pool) {
    return;
  }

  await runSchema();
}
