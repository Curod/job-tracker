import { Router } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { companies } from "../db/schema.js";
import { HttpError } from "../errors.js";
import { pgErrorCode, PG_FOREIGN_KEY_VIOLATION, PG_RESTRICT_VIOLATION, requireId } from "../http.js";

const companyInput = z.object({
  name: z.string().trim().min(1).max(200),
  website: z.url().max(500).nullish(),
  notes: z.string().max(5000).nullish(),
});

export const companiesRouter = Router();

companiesRouter.get("/", async (_req, res) => {
  const rows = await db.select().from(companies).orderBy(companies.name);
  res.json(rows);
});

companiesRouter.get("/:id", async (req, res) => {
  const id = requireId(req.params.id);
  const [company] = await db.select().from(companies).where(eq(companies.id, id));
  if (!company) throw new HttpError(404, "Company not found");
  res.json(company);
});

companiesRouter.post("/", async (req, res) => {
  const data = companyInput.parse(req.body);
  const [created] = await db.insert(companies).values(data).returning();
  res.status(201).json(created);
});

companiesRouter.patch("/:id", async (req, res) => {
  const id = requireId(req.params.id);
  const data = companyInput.partial().parse(req.body);

  const [updated] = await db
    .update(companies)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(companies.id, id))
    .returning();

  if (!updated) throw new HttpError(404, "Company not found");
  res.json(updated);
});

companiesRouter.delete("/:id", async (req, res) => {
  const id = requireId(req.params.id);

  try {
    const [deleted] = await db
      .delete(companies)
      .where(eq(companies.id, id))
      .returning({ id: companies.id });

    if (!deleted) throw new HttpError(404, "Company not found");
    res.status(204).end();
  } catch (err) {
    const code = pgErrorCode(err);
    if (code === PG_RESTRICT_VIOLATION || code === PG_FOREIGN_KEY_VIOLATION) {
      throw new HttpError(409, "Company has applications; delete or move them first");
    }
    throw err;
  }
});