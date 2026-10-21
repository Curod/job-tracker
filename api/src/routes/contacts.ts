import { Router } from "express";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { companies, contacts } from "../db/schema.js";
import { HttpError } from "../errors.js";
import { pgErrorCode, PG_FOREIGN_KEY_VIOLATION, requireId } from "../http.js";

const contactInput = z.object({
  name: z.string().trim().min(1).max(200),
  role: z.string().trim().max(200).nullish(),
  email: z.email().max(320).nullish(),
  linkedinUrl: z.url().max(500).nullish(),
  notes: z.string().max(5000).nullish(),
});

export const contactsRouter = Router();

contactsRouter.get("/companies/:companyId/contacts", async (req, res) => {
  const companyId = requireId(req.params.companyId);

  const [company] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.id, companyId));

  if (!company) throw new HttpError(404, "Company not found");

  const rows = await db
    .select()
    .from(contacts)
    .where(eq(contacts.companyId, companyId))
    .orderBy(asc(contacts.name));

  res.json(rows);
});

contactsRouter.post("/companies/:companyId/contacts", async (req, res) => {
  const companyId = requireId(req.params.companyId);
  const data = contactInput.parse(req.body);

  try {
    const [created] = await db
      .insert(contacts)
      .values({ ...data, companyId })
      .returning();
    res.status(201).json(created);
  } catch (err) {
    if (pgErrorCode(err) === PG_FOREIGN_KEY_VIOLATION) {
      throw new HttpError(404, "Company not found");
    }
    throw err;
  }
});

contactsRouter.patch("/contacts/:id", async (req, res) => {
  const id = requireId(req.params.id);
  const data = contactInput.partial().parse(req.body);

  const [updated] = await db
    .update(contacts)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(contacts.id, id))
    .returning();

  if (!updated) throw new HttpError(404, "Contact not found");
  res.json(updated);
});

contactsRouter.delete("/contacts/:id", async (req, res) => {
  const id = requireId(req.params.id);

  const [deleted] = await db
    .delete(contacts)
    .where(eq(contacts.id, id))
    .returning({ id: contacts.id });

  if (!deleted) throw new HttpError(404, "Contact not found");
  res.status(204).end();
});