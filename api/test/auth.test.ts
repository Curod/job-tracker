import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { pool } from "../src/db/client.js";
import { resetDb } from "./helpers.js";

beforeEach(resetDb);
afterAll(() => pool.end());

const credentials = { email: "dor@example.com", password: "correct-horse-battery" };

describe("POST /auth/signup", () => {
  it("creates a user without exposing the password hash", async () => {
    const res = await request(app).post("/auth/signup").send(credentials);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: expect.any(Number), email: "dor@example.com" });
    expect(res.body).not.toHaveProperty("passwordHash");
  });

  it("stores an Argon2id hash, not the password", async () => {
    await request(app).post("/auth/signup").send(credentials);

    const { rows } = await pool.query("SELECT password_hash FROM users");
    expect(rows[0].password_hash).not.toBe(credentials.password);
    expect(rows[0].password_hash.startsWith("$argon2id$")).toBe(true);
  });

  it("normalizes the email", async () => {
    const res = await request(app)
      .post("/auth/signup")
      .send({ ...credentials, email: "  Dor@Example.COM " });
    expect(res.body.email).toBe("dor@example.com");
  });

  it("rejects a duplicate email regardless of case", async () => {
    await request(app).post("/auth/signup").send(credentials);
    const res = await request(app)
      .post("/auth/signup")
      .send({ ...credentials, email: "DOR@example.com" });
    expect(res.status).toBe(409);
  });

  it("rejects an invalid email or short password", async () => {
    const badEmail = await request(app)
      .post("/auth/signup")
      .send({ email: "nope", password: "correct-horse-battery" });
    const shortPassword = await request(app)
      .post("/auth/signup")
      .send({ email: "dor@example.com", password: "short" });

    expect(badEmail.status).toBe(400);
    expect(shortPassword.status).toBe(400);
  });
});