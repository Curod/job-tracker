import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { pool } from "../src/db/client.js";
import { resetDb, signedInAgent, type TestAgent } from "./helpers.js";

let agent: TestAgent;

beforeEach(async () => {
  await resetDb();
  agent = await signedInAgent();
});
afterAll(() => pool.end());

describe("companies API", () => {
  it("creates a company", async () => {
    const res = await agent
      .post("/companies")
      .send({ name: "Wix", website: "https://www.wix.com" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: expect.any(Number), name: "Wix" });
  });

  it("rejects invalid input with details", async () => {
    const res = await agent
      .post("/companies")
      .send({ name: "  ", website: "not-a-url" });

    expect(res.status).toBe(400);
    expect(res.body.issues).toHaveLength(2);
  });

  it("returns 404 for a missing company", async () => {
    const res = await agent.get("/companies/999");
    expect(res.status).toBe(404);
  });

  it("returns 400 for an invalid id", async () => {
    const res = await agent.get("/companies/abc");
    expect(res.status).toBe(400);
  });

  it("refuses to delete a company that has applications", async () => {
    const company = await agent.post("/companies").send({ name: "Monday.com" });
    await agent
      .post("/applications")
      .send({ companyId: company.body.id, roleTitle: "Backend Developer" });

    const res = await agent.delete(`/companies/${company.body.id}`);
    expect(res.status).toBe(409);
  });
});