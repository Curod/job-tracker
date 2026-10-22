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

describe("sessions", () => {
  function sessionCookie(res: request.Response): string {
    const cookies = res.headers["set-cookie"] as unknown as string[];
    return cookies.find((c) => c.startsWith("session=")) ?? "";
  }

  it("sets an httpOnly, SameSite=Lax session cookie on signup", async () => {
    const res = await request(app).post("/auth/signup").send(credentials);
    const cookie = sessionCookie(res);

    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
  });

  it("stores only a hash of the session token", async () => {
    const res = await request(app).post("/auth/signup").send(credentials);
    const token = sessionCookie(res).split(";")[0]!.split("=")[1]!;

    const { rows } = await pool.query("SELECT token_hash FROM sessions");
    expect(rows[0].token_hash).toHaveLength(64);
    expect(rows[0].token_hash).not.toBe(token);
  });

  it("logs in and identifies the user on later requests", async () => {
    await request(app).post("/auth/signup").send(credentials);

    const agent = request.agent(app);
    const login = await agent.post("/auth/login").send(credentials);
    expect(login.status).toBe(200);

    const me = await agent.get("/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.email).toBe("dor@example.com");
  });

  it("gives the same 401 for a wrong password and an unknown email", async () => {
    await request(app).post("/auth/signup").send(credentials);

    const wrongPassword = await request(app)
      .post("/auth/login")
      .send({ ...credentials, password: "wrong-password" });
    const unknownEmail = await request(app)
      .post("/auth/login")
      .send({ ...credentials, email: "nobody@example.com" });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknownEmail.body);
  });

  it("rejects /auth/me without a session", async () => {
    const res = await request(app).get("/auth/me");
    expect(res.status).toBe(401);
  });

  it("ends the session on logout", async () => {
    const agent = request.agent(app);
    await agent.post("/auth/signup").send(credentials);

    const logout = await agent.post("/auth/logout");
    expect(logout.status).toBe(204);

    const me = await agent.get("/auth/me");
    expect(me.status).toBe(401);

    const { rows } = await pool.query("SELECT count(*)::int AS count FROM sessions");
    expect(rows[0].count).toBe(0);
  });

  it("rejects an expired session", async () => {
    const agent = request.agent(app);
    await agent.post("/auth/signup").send(credentials);
    await pool.query("UPDATE sessions SET expires_at = now() - interval '1 minute'");

    expect((await agent.get("/auth/me")).status).toBe(401);
  });

  it("rejects a forged session cookie", async () => {
    const res = await request(app).get("/auth/me").set("Cookie", "session=forged-token");
    expect(res.status).toBe(401);
  });
});