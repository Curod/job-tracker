import { Router } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { currentUser } from "../auth/middleware.js";
import { findOwnedCompany, ownedCompanyIds } from "../auth/ownership.js";
import { db } from "../db/client.js";
import { applicationStatus, applications, companies } from "../db/schema.js";
import { canTransition } from "../domain/status.js";
import { HttpError } from "../errors.js";
import { pgErrorCode, PG_FOREIGN_KEY_VIOLATION, requireId } from "../http.js";

const COMPANY_NOT_FOUND = "companyId does not refer to an existing company";

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

const statusInput = z.object({ status: statusSchema });

export const applicationsRouter = Router();

applicationsRouter.get("/", async (req, res) => {
  const user = currentUser(req);
  const { status, companyId } = listQuery.parse(req.query);

  const conditions = [eq(companies.userId, user.id)];
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
  const user = currentUser(req);
  const id = requireId(req.params.id);

  const [row] = await db
    .select({ application: applications, companyName: companies.name })
    .from(applications)
    .innerJoin(companies, eq(applications.companyId, companies.id))
    .where(and(eq(applications.id, id), eq(companies.userId, user.id)));

  if (!row) throw new HttpError(404, "Application not found");
  res.json({ ...row.application, companyName: row.companyName });
});

applicationsRouter.post("/", async (req, res) => {
  const user = currentUser(req);
  const data = applicationInput.parse(req.body);

  if (!(await findOwnedCompany(user.id, data.companyId))) {
    throw new HttpError(400, COMPANY_NOT_FOUND);
  }

  try {
    const [created] = await db.insert(applications).values(data).returning();
    res.status(201).json(created);
  } catch (err) {
    if (pgErrorCode(err) === PG_FOREIGN_KEY_VIOLATION) throw new HttpError(400, COMPANY_NOT_FOUND);
    throw err;
  }
});

applicationsRouter.patch("/:id", async (req, res) => {
  const user = currentUser(req);
  const id = requireId(req.params.id);
  const data = applicationInput.partial().parse(req.body);

  if (data.companyId !== undefined && !(await findOwnedCompany(user.id, data.companyId))) {
    throw new HttpError(400, COMPANY_NOT_FOUND);
  }

  try {
    const [updated] = await db
      .update(applications)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(applications.id, id), inArray(applications.companyId, ownedCompanyIds(user.id))))
      .returning();

    if (!updated) throw new HttpError(404, "Application not found");
    res.json(updated);
  } catch (err) {
    if (pgErrorCode(err) === PG_FOREIGN_KEY_VIOLATION) throw new HttpError(400, COMPANY_NOT_FOUND);
    throw err;
  }
});

applicationsRouter.patch("/:id/status", async (req, res) => {
  const user = currentUser(req);
  const id = requireId(req.params.id);
  const { status: to } = statusInput.parse(req.body);

  const [current] = await db
    .select({ status: applications.status })
    .from(applications)
    .where(and(eq(applications.id, id), inArray(applications.companyId, ownedCompanyIds(user.id))));

  if (!current) throw new HttpError(404, "Application not found");

  if (!canTransition(current.status, to)) {
    throw new HttpError(409, `Cannot move from '${current.status}' to '${to}'`);
  }

  const [updated] = await db
    .update(applications)
    .set({ status: to, updatedAt: new Date() })
    .where(and(eq(applications.id, id), eq(applications.status, current.status)))
    .returning();

  if (!updated) {
    throw new HttpError(409, "Status changed by another request; reload and try again");
  }

  res.json(updated);
});

applicationsRouter.delete("/:id", async (req, res) => {
  const user = currentUser(req);
  const id = requireId(req.params.id);

  const [deleted] = await db
    .delete(applications)
    .where(and(eq(applications.id, id), inArray(applications.companyId, ownedCompanyIds(user.id))))
    .returning({ id: applications.id });

  if (!deleted) throw new HttpError(404, "Application not found");
  res.status(204).end();
});