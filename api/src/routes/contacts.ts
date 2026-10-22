import { Router } from "express";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { currentUser } from "../auth/middleware.js";
import { findOwnedCompany, ownedCompanyIds } from "../auth/ownership.js";
import { db } from "../db/client.js";
import { contacts } from "../db/schema.js";
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
  const user = currentUser(req);
  const companyId = requireId(req.params.companyId);

  if (!(await findOwnedCompany(user.id, companyId))) {
    throw new HttpError(404, "Company not found");
  }

  const rows = await db
    .select()
    .from(contacts)
    .where(eq(contacts.companyId, companyId))
    .orderBy(asc(contacts.name));

  res.json(rows);
});

contactsRouter.post("/companies/:companyId/contacts", async (req, res) => {
  const user = currentUser(req);
  const companyId = requireId(req.params.companyId);
  const data = contactInput.parse(req.body);

  if (!(await findOwnedCompany(user.id, companyId))) {
    throw new HttpError(404, "Company not found");
  }

  try {
    const [created] = await db
      .insert(contacts)
      .values({ ...data, companyId })
      .returning();
    res.status(201).json(created);
  } catch (err) {
    if (pgErrorCode(err) === PG_FOREIGN_KEY_VIOLATION) throw new HttpError(404, "Company not found");
    throw err;
  }
});

contactsRouter.patch("/contacts/:id", async (req, res) => {
  const user = currentUser(req);
  const id = requireId(req.params.id);
  const data = contactInput.partial().parse(req.body);

  const [updated] = await db
    .update(contacts)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(contacts.id, id), inArray(contacts.companyId, ownedCompanyIds(user.id))))
    .returning();

  if (!updated) throw new HttpError(404, "Contact not found");
  res.json(updated);
});

contactsRouter.delete("/contacts/:id", async (req, res) => {
  const user = currentUser(req);
  const id = requireId(req.params.id);

  const [deleted] = await db
    .delete(contacts)
    .where(and(eq(contacts.id, id), inArray(contacts.companyId, ownedCompanyIds(user.id))))
    .returning({ id: contacts.id });

  if (!deleted) throw new HttpError(404, "Contact not found");
  res.status(204).end();
});