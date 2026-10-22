import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { pool } from "../src/db/client.js";
import { resetDb, signedInAgent, type TestAgent } from "./helpers.js";

let agent: TestAgent;

beforeEach(async () => {
  await resetDb();
  agent = await signedInAgent();
});
afterAll(() => pool.end());

async function createCompany(name = "Monday.com") {
  const res = await agent.post("/companies").send({ name });
  return res.body;
}

describe("contacts API", () => {
  it("adds a contact to a company", async () => {
    const company = await createCompany();
    const res = await agent
      .post(`/companies/${company.id}/contacts`)
      .send({ name: "Dana Levi", role: "Recruiter", email: "dana@example.com" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ companyId: company.id, name: "Dana Levi" });
  });

  it("rejects an invalid email", async () => {
    const company = await createCompany();
    const res = await agent
      .post(`/companies/${company.id}/contacts`)
      .send({ name: "Dana Levi", email: "not-an-email" });
    expect(res.status).toBe(400);
  });

  it("returns 404 for a missing company", async () => {
    const list = await agent.get("/companies/999/contacts");
    const create = await agent.post("/companies/999/contacts").send({ name: "Dana Levi" });
    expect(list.status).toBe(404);
    expect(create.status).toBe(404);
  });

  it("lists only the contacts of that company", async () => {
    const a = await createCompany("Monday.com");
    const b = await createCompany("Wix");
    await agent.post(`/companies/${a.id}/contacts`).send({ name: "Dana Levi" });
    await agent.post(`/companies/${b.id}/contacts`).send({ name: "Yossi Cohen" });

    const res = await agent.get(`/companies/${a.id}/contacts`);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe("Dana Levi");
  });

  it("deletes contacts together with their company", async () => {
    const company = await createCompany();
    await agent.post(`/companies/${company.id}/contacts`).send({ name: "Dana Levi" });

    const res = await agent.delete(`/companies/${company.id}`);
    expect(res.status).toBe(204);

    const { rows } = await pool.query("SELECT count(*)::int AS count FROM contacts");
    expect(rows[0].count).toBe(0);
  });
});