import { pool } from "../src/db/client.js";

export async function resetDb() {
  if (!process.env.DATABASE_URL?.endsWith("_test")) {
    throw new Error("resetDb refused: not connected to a _test database");
  }
  await pool.query(
    "TRUNCATE notes, contacts, applications, companies, users RESTART IDENTITY CASCADE",
  );
}