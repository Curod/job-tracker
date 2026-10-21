import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { pool } from "../src/db/client.js";
import { resetDb } from "./helpers.js";

beforeEach(resetDb);
afterAll(() => pool.end());

async function createApplication() {
  const company = await request(app).post("/companies").send({ name: "Monday.com" });
  const application = await request(app)
    .post("/applications")
    .send({ companyId: company.body.id, roleTitle: "Backend Developer" });
  return application.body;
}

describe("notes API", () => {
  it("adds a note to an application", async () => {
    const application = await createApplication();
    const res = await request(app)
      .post(`/applications/${application.id}/notes`)
      .send({ body: "Phone screen went well" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ applicationId: application.id, body: "Phone screen went well" });
  });

  it("rejects an empty note", async () => {
    const application = await createApplication();
    const res = await request(app)
      .post(`/applications/${application.id}/notes`)
      .send({ body: "   " });
    expect(res.status).toBe(400);
  });

  it("returns 404 for a missing application", async () => {
    const res = await request(app).post("/applications/999/notes").send({ body: "Hello" });
    expect(res.status).toBe(404);
  });

  it("lists notes newest first", async () => {
    const application = await createApplication();
    await request(app).post(`/applications/${application.id}/notes`).send({ body: "First" });
    await request(app).post(`/applications/${application.id}/notes`).send({ body: "Second" });

    const res = await request(app).get(`/applications/${application.id}/notes`);
    expect(res.body.map((n: { body: string }) => n.body)).toEqual(["Second", "First"]);
  });

  it("deletes notes together with their application", async () => {
    const application = await createApplication();
    await request(app).post(`/applications/${application.id}/notes`).send({ body: "First" });

    const res = await request(app).delete(`/applications/${application.id}`);
    expect(res.status).toBe(204);

    const { rows } = await pool.query("SELECT count(*)::int AS count FROM notes");
    expect(rows[0].count).toBe(0);
  });
});