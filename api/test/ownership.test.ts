import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { pool } from "../src/db/client.js";
import { resetDb, signedInAgent, type TestAgent } from "./helpers.js";

let alice: TestAgent;
let bob: TestAgent;
let aliceCompanyId: number;
let aliceApplicationId: number;

beforeEach(async () => {
  await resetDb();
  alice = await signedInAgent("alice@example.com");
  bob = await signedInAgent("bob@example.com");

  const company = await alice.post("/companies").send({ name: "Monday.com" });
  aliceCompanyId = company.body.id;

  const application = await alice
    .post("/applications")
    .send({ companyId: aliceCompanyId, roleTitle: "Backend Developer" });
  aliceApplicationId = application.body.id;
});
afterAll(() => pool.end());

describe("data ownership", () => {
  it("requires login for protected routes", async () => {
    const res = await request(app).get("/companies");
    expect(res.status).toBe(401);
  });

  it("does not list another user's data", async () => {
    const companies = await bob.get("/companies");
    const applications = await bob.get("/applications");
    expect(companies.body).toEqual([]);
    expect(applications.body).toEqual([]);
  });

  it("returns 404 for another user's company and application", async () => {
    expect((await bob.get(`/companies/${aliceCompanyId}`)).status).toBe(404);
    expect((await bob.get(`/applications/${aliceApplicationId}`)).status).toBe(404);
  });

  it("cannot modify or delete another user's data", async () => {
    const patch = await bob.patch(`/companies/${aliceCompanyId}`).send({ name: "Hacked" });
    const status = await bob
      .patch(`/applications/${aliceApplicationId}/status`)
      .send({ status: "rejected" });
    const del = await bob.delete(`/applications/${aliceApplicationId}`);

    expect(patch.status).toBe(404);
    expect(status.status).toBe(404);
    expect(del.status).toBe(404);

    const company = await alice.get(`/companies/${aliceCompanyId}`);
    const application = await alice.get(`/applications/${aliceApplicationId}`);
    expect(company.body.name).toBe("Monday.com");
    expect(application.body.status).toBe("applied");
  });

  it("cannot attach records to another user's company or application", async () => {
    const application = await bob
      .post("/applications")
      .send({ companyId: aliceCompanyId, roleTitle: "Backend Developer" });
    const contact = await bob
      .post(`/companies/${aliceCompanyId}/contacts`)
      .send({ name: "Dana Levi" });
    const note = await bob
      .post(`/applications/${aliceApplicationId}/notes`)
      .send({ body: "Sneaky" });

    expect(application.status).toBe(400);
    expect(contact.status).toBe(404);
    expect(note.status).toBe(404);
  });

  it("cannot read another user's contacts or notes", async () => {
    expect((await bob.get(`/companies/${aliceCompanyId}/contacts`)).status).toBe(404);
    expect((await bob.get(`/applications/${aliceApplicationId}/notes`)).status).toBe(404);
  });
});