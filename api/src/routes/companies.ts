import { Router } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { companies } from "../db/schema.js";
import { parseId, pgErrorCode, PG_FOREIGN_KEY_VIOLATION, PG_RESTRICT_VIOLATION } from "../http.js";
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
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [company] = await db.select().from(companies).where(eq(companies.id, id));
  if (!company) {
    res.status(404).json({ error: "Company not found" });
    return;
  }

  res.json(company);
});

companiesRouter.post("/", async (req, res) => {
  const parsed = companyInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });
    return;
  }

  const [created] = await db.insert(companies).values(parsed.data).returning();
  res.status(201).json(created);
});

companiesRouter.patch("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = companyInput.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });
    return;
  }

  const [updated] = await db
    .update(companies)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(companies.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Company not found" });
    return;
  }

  res.json(updated);
});

companiesRouter.delete("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  try {
    const [deleted] = await db
      .delete(companies)
      .where(eq(companies.id, id))
      .returning({ id: companies.id });

    if (!deleted) {
      res.status(404).json({ error: "Company not found" });
      return;
    }

    res.status(204).end();
    } catch (err) {
    const code = pgErrorCode(err);
    if (code === PG_RESTRICT_VIOLATION || code === PG_FOREIGN_KEY_VIOLATION) {
      res.status(409).json({ error: "Company has applications; delete or move them first" });
      return;
    }
    throw err;
  }
});