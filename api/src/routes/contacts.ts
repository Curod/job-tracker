import { Router } from "express";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { companies, contacts } from "../db/schema.js";
import { parseId, pgErrorCode, PG_FOREIGN_KEY_VIOLATION } from "../http.js";

const contactInput = z.object({
  name: z.string().trim().min(1).max(200),
  role: z.string().trim().max(200).nullish(),
  email: z.email().max(320).nullish(),
  linkedinUrl: z.url().max(500).nullish(),
  notes: z.string().max(5000).nullish(),
});

export const contactsRouter = Router();

contactsRouter.get("/companies/:companyId/contacts", async (req, res) => {
  const companyId = parseId(req.params.companyId);
  if (companyId === null) {
    res.status(400).json({ error: "Invalid company id" });
    return;
  }

  const [company] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.id, companyId));

  if (!company) {
    res.status(404).json({ error: "Company not found" });
    return;
  }

  const rows = await db
    .select()
    .from(contacts)
    .where(eq(contacts.companyId, companyId))
    .orderBy(asc(contacts.name));

  res.json(rows);
});

contactsRouter.post("/companies/:companyId/contacts", async (req, res) => {
  const companyId = parseId(req.params.companyId);
  if (companyId === null) {
    res.status(400).json({ error: "Invalid company id" });
    return;
  }

  const parsed = contactInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });
    return;
  }

  try {
    const [created] = await db
      .insert(contacts)
      .values({ ...parsed.data, companyId })
      .returning();
    res.status(201).json(created);
  } catch (err) {
    if (pgErrorCode(err) === PG_FOREIGN_KEY_VIOLATION) {
      res.status(404).json({ error: "Company not found" });
      return;
    }
    throw err;
  }
});

contactsRouter.patch("/contacts/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = contactInput.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });
    return;
  }

  const [updated] = await db
    .update(contacts)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(contacts.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Contact not found" });
    return;
  }

  res.json(updated);
});

contactsRouter.delete("/contacts/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [deleted] = await db
    .delete(contacts)
    .where(eq(contacts.id, id))
    .returning({ id: contacts.id });

  if (!deleted) {
    res.status(404).json({ error: "Contact not found" });
    return;
  }

  res.status(204).end();
});