import { Router } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { currentUser } from "../auth/middleware.js";
import { findOwnedApplication, ownedApplicationIds } from "../auth/ownership.js";
import { db } from "../db/client.js";
import { notes } from "../db/schema.js";
import { HttpError } from "../errors.js";
import { pgErrorCode, PG_FOREIGN_KEY_VIOLATION, requireId } from "../http.js";

const noteInput = z.object({
  body: z.string().trim().min(1).max(10000),
});

export const notesRouter = Router();

notesRouter.get("/applications/:applicationId/notes", async (req, res) => {
  const user = currentUser(req);
  const applicationId = requireId(req.params.applicationId);

  if (!(await findOwnedApplication(user.id, applicationId))) {
    throw new HttpError(404, "Application not found");
  }

  const rows = await db
    .select()
    .from(notes)
    .where(eq(notes.applicationId, applicationId))
    .orderBy(desc(notes.createdAt), desc(notes.id));

  res.json(rows);
});

notesRouter.post("/applications/:applicationId/notes", async (req, res) => {
  const user = currentUser(req);
  const applicationId = requireId(req.params.applicationId);
  const data = noteInput.parse(req.body);

  if (!(await findOwnedApplication(user.id, applicationId))) {
    throw new HttpError(404, "Application not found");
  }

  try {
    const [created] = await db
      .insert(notes)
      .values({ ...data, applicationId })
      .returning();
    res.status(201).json(created);
  } catch (err) {
    if (pgErrorCode(err) === PG_FOREIGN_KEY_VIOLATION) throw new HttpError(404, "Application not found");
    throw err;
  }
});

notesRouter.delete("/notes/:id", async (req, res) => {
  const user = currentUser(req);
  const id = requireId(req.params.id);

  const [deleted] = await db
    .delete(notes)
    .where(and(eq(notes.id, id), inArray(notes.applicationId, ownedApplicationIds(user.id))))
    .returning({ id: notes.id });

  if (!deleted) throw new HttpError(404, "Note not found");
  res.status(204).end();
});