import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { applicationStatus, applications, companies } from "../db/schema.js";
import { canTransition } from "../domain/status.js";
import { parseId, pgErrorCode } from "../http.js";

const statusSchema = z.enum(applicationStatus.enumValues);

const applicationInput = z.object({
  companyId: z.number().int().positive(),
  roleTitle: z.string().trim().min(1).max(200),
  jobUrl: z.url().max(1000).nullish(),
  appliedAt: z.iso.date().nullish(),
  cvVersion: z.string().trim().max(100).nullish(),
});

const listQuery = z.object({
  status: statusSchema.optional(),
  companyId: z.coerce.number().int().positive().optional(),
});

export const applicationsRouter = Router();

applicationsRouter.get("/", async (req, res) => {
  const parsed = listQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query", issues: parsed.error.issues });
    return;
  }
  const { status, companyId } = parsed.data;

  const conditions = [];
  if (status) conditions.push(eq(applications.status, status));
  if (companyId) conditions.push(eq(applications.companyId, companyId));

  const rows = await db
    .select({ application: applications, companyName: companies.name })
    .from(applications)
    .innerJoin(companies, eq(applications.companyId, companies.id))
    .where(and(...conditions))
    .orderBy(desc(applications.createdAt));

  res.json(rows.map((r) => ({ ...r.application, companyName: r.companyName })));
});

applicationsRouter.get("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [row] = await db
    .select({ application: applications, companyName: companies.name })
    .from(applications)
    .innerJoin(companies, eq(applications.companyId, companies.id))
    .where(eq(applications.id, id));

  if (!row) {
    res.status(404).json({ error: "Application not found" });
    return;
  }

  res.json({ ...row.application, companyName: row.companyName });
});

applicationsRouter.post("/", async (req, res) => {
  const parsed = applicationInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });
    return;
  }

  try {
    const [created] = await db.insert(applications).values(parsed.data).returning();
    res.status(201).json(created);
  } catch (err) {
    if (pgErrorCode(err) === "23503") {
      res.status(400).json({ error: "companyId does not refer to an existing company" });
      return;
    }
    throw err;
  }
});

applicationsRouter.patch("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = applicationInput.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });
    return;
  }

  try {
    const [updated] = await db
      .update(applications)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(applications.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Application not found" });
      return;
    }

    res.json(updated);
  } catch (err) {
    if (pgErrorCode(err) === "23503") {
      res.status(400).json({ error: "companyId does not refer to an existing company" });
      return;
    }
    throw err;
  }
});

applicationsRouter.patch("/:id/status", async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = z.object({ status: statusSchema }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", issues: parsed.error.issues });
    return;
  }
  const to = parsed.data.status;

  const [current] = await db
    .select({ status: applications.status })
    .from(applications)
    .where(eq(applications.id, id));

  if (!current) {
    res.status(404).json({ error: "Application not found" });
    return;
  }

  if (!canTransition(current.status, to)) {
    res.status(409).json({ error: `Cannot move from '${current.status}' to '${to}'` });
    return;
  }

  const [updated] = await db
    .update(applications)
    .set({ status: to, updatedAt: new Date() })
    .where(and(eq(applications.id, id), eq(applications.status, current.status)))
    .returning();

  if (!updated) {
    res.status(409).json({ error: "Status changed by another request; reload and try again" });
    return;
  }

  res.json(updated);
});

applicationsRouter.delete("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [deleted] = await db
    .delete(applications)
    .where(eq(applications.id, id))
    .returning({ id: applications.id });

  if (!deleted) {
    res.status(404).json({ error: "Application not found" });
    return;
  }

  res.status(204).end();
});