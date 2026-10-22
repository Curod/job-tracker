import request from "supertest";
import { app } from "../src/app.js";
import { pool } from "../src/db/client.js";

export type TestAgent = ReturnType<typeof request.agent>;

export async function resetDb() {
  if (!process.env.DATABASE_URL?.endsWith("_test")) {
    throw new Error("resetDb refused: not connected to a _test database");
  }
  await pool.query(
    "TRUNCATE sessions, notes, contacts, applications, companies, users RESTART IDENTITY CASCADE",
  );
}

let userCounter = 0;

export async function signedInAgent(email = `user${++userCounter}@example.com`): Promise<TestAgent> {
  const agent = request.agent(app);
  const res = await agent.post("/auth/signup").send({ email, password: "correct-horse-battery" });
  if (res.status !== 201) throw new Error(`Test signup failed with status ${res.status}`);
  return agent;
}