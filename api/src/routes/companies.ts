import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { currentUser } from "../auth/middleware.js";
import { db } from "../db/client.js";
import { companies } from "../db/schema.js";
import { HttpError } from "../errors.js";
import { pgErrorCode, PG_FOREIGN_KEY_VIOLATION, PG_RESTRICT_VIOLATION, requireId } from "../http.js";
import { httpUrl } from "../validation.js";

const companyInput = z.object({
  name: z.string().trim().min(1).max(200),
  website: httpUrl.max(500).nullish(),
  notes: z.string().max(5000).nullish(),
});

export const companiesRouter = Router();

companiesRouter.get("/", async (req, res) => {
  const user = currentUser(req);
  const rows = await db
    .select()
    .from(companies)
    .where(eq(companies.userId, user.id))
    .orderBy(companies.name);
  res.json(rows);
});

companiesRouter.get("/:id", async (req, res) => {
  const user = currentUser(req);
  const id = requireId(req.params.id);

  const [company] = await db
    .select()
    .from(companies)
    .where(and(eq(companies.id, id), eq(companies.userId, user.id)));

  if (!company) throw new HttpError(404, "Company not found");
  res.json(company);
});

companiesRouter.post("/", async (req, res) => {
  const user = currentUser(req);
  const data = companyInput.parse(req.body);

  const [created] = await db
    .insert(companies)
    .values({ ...data, userId: user.id })
    .returning();

  res.status(201).json(created);
});

companiesRouter.patch("/:id", async (req, res) => {
  const user = currentUser(req);
  const id = requireId(req.params.id);
  const data = companyInput.partial().parse(req.body);

  const [updated] = await db
    .update(companies)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(companies.id, id), eq(companies.userId, user.id)))
    .returning();

  if (!updated) throw new HttpError(404, "Company not found");
  res.json(updated);
});

companiesRouter.delete("/:id", async (req, res) => {
  const user = currentUser(req);
  const id = requireId(req.params.id);

  try {
    const [deleted] = await db
      .delete(companies)
      .where(and(eq(companies.id, id), eq(companies.userId, user.id)))
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