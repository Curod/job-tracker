import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { pool } from "../src/db/client.js";
import { resetDb, signedInAgent, type TestAgent } from "./helpers.js";

let agent: TestAgent;

beforeEach(async () => {
  await resetDb();
  agent = await signedInAgent();
});
afterAll(() => pool.end());

describe("input hardening", () => {
  it("rejects non-http URLs", async () => {
    const res = await agent
      .post("/companies")
      .send({ name: "Evil Corp", website: "javascript:alert(1)" });
    expect(res.status).toBe(400);
  });

  it("accepts https URLs", async () => {
    const res = await agent
      .post("/companies")
      .send({ name: "Wix", website: "https://www.wix.com" });
    expect(res.status).toBe(201);
  });

  it("returns 400, not 500, for ids outside the valid range or format", async () => {
    expect((await agent.get("/companies/99999999999")).status).toBe(400);
    expect((await agent.get("/companies/1e3")).status).toBe(400);

    const res = await agent
      .post("/applications")
      .send({ companyId: 99999999999, roleTitle: "Backend Developer" });
    expect(res.status).toBe(400);
  });

  it("returns 400 for malformed JSON", async () => {
    const res = await agent
      .post("/companies")
      .set("Content-Type", "application/json")
      .send('{"name":');
    expect(res.status).toBe(400);
  });

  it("returns 413 for an oversized body", async () => {
    const res = await agent
      .post("/companies")
      .send({ name: "Big", notes: "a".repeat(200_000) });
    expect(res.status).toBe(413);
  });

  it("returns validation issues as path and message only", async () => {
    const res = await agent.post("/companies").send({ name: "" });
    expect(res.body.issues[0]).toEqual({ path: "name", message: expect.any(String) });
  });
});