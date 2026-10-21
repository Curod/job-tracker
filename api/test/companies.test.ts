import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { pool } from "../src/db/client.js";
import { resetDb } from "./helpers.js";

beforeEach(resetDb);
afterAll(() => pool.end());

describe("companies API", () => {
  it("creates a company", async () => {
    const res = await request(app)
      .post("/companies")
      .send({ name: "Wix", website: "https://www.wix.com" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: expect.any(Number), name: "Wix" });
  });

  it("rejects invalid input with details", async () => {
    const res = await request(app)
      .post("/companies")
      .send({ name: "  ", website: "not-a-url" });

    expect(res.status).toBe(400);
    expect(res.body.issues).toHaveLength(2);
  });

  it("returns 404 for a missing company", async () => {
    const res = await request(app).get("/companies/999");
    expect(res.status).toBe(404);
  });

  it("returns 400 for an invalid id", async () => {
    const res = await request(app).get("/companies/abc");
    expect(res.status).toBe(400);
  });

  it("refuses to delete a company that has applications", async () => {
    const company = await request(app).post("/companies").send({ name: "Monday.com" });
    await request(app)
      .post("/applications")
      .send({ companyId: company.body.id, roleTitle: "Backend Developer" });

    const res = await request(app).delete(`/companies/${company.body.id}`);
    expect(res.status).toBe(409);
  });
});