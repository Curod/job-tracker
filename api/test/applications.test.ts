import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { pool } from "../src/db/client.js";
import { resetDb, signedInAgent, type TestAgent } from "./helpers.js";

let agent: TestAgent;

beforeEach(async () => {
  await resetDb();
  agent = await signedInAgent();
});
afterAll(() => pool.end());

async function createApplication() {
  const company = await agent.post("/companies").send({ name: "Monday.com" });
  const application = await agent
    .post("/applications")
    .send({ companyId: company.body.id, roleTitle: "Backend Developer" });
  return application.body;
}

describe("applications API", () => {
  it("creates an application with status 'applied'", async () => {
    const application = await createApplication();
    expect(application.status).toBe("applied");
  });

  it("returns 400 when the company does not exist", async () => {
    const res = await agent
      .post("/applications")
      .send({ companyId: 999, roleTitle: "Backend Developer" });
    expect(res.status).toBe(400);
  });

  it("includes the company name in the list", async () => {
    await createApplication();
    const res = await agent.get("/applications");
    expect(res.body).toHaveLength(1);
    expect(res.body[0].companyName).toBe("Monday.com");
  });

  it("filters by status", async () => {
    const application = await createApplication();
    await agent
      .patch(`/applications/${application.id}/status`)
      .send({ status: "interview" });

    const interviews = await agent.get("/applications?status=interview");
    const applied = await agent.get("/applications?status=applied");
    expect(interviews.body).toHaveLength(1);
    expect(applied.body).toHaveLength(0);
  });

  it("moves forward and refuses to move backwards", async () => {
    const application = await createApplication();

    const forward = await agent
      .patch(`/applications/${application.id}/status`)
      .send({ status: "interview" });
    expect(forward.status).toBe(200);

    const backward = await agent
      .patch(`/applications/${application.id}/status`)
      .send({ status: "screening" });
    expect(backward.status).toBe(409);
  });

  it("ignores status in a regular PATCH", async () => {
    const application = await createApplication();
    const res = await agent
      .patch(`/applications/${application.id}`)
      .send({ status: "offer", roleTitle: "Senior Backend Developer" });

    expect(res.status).toBe(200);
    expect(res.body.roleTitle).toBe("Senior Backend Developer");
    expect(res.body.status).toBe("applied");
  });
});