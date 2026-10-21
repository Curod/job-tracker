import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { applications, notes } from "../db/schema.js";
import { HttpError } from "../errors.js";
import { pgErrorCode, PG_FOREIGN_KEY_VIOLATION, requireId } from "../http.js";

const noteInput = z.object({
  body: z.string().trim().min(1).max(10000),
});

export const notesRouter = Router();

notesRouter.get("/applications/:applicationId/notes", async (req, res) => {
  const applicationId = requireId(req.params.applicationId);

  const [application] = await db
    .select({ id: applications.id })
    .from(applications)
    .where(eq(applications.id, applicationId));

  if (!application) throw new HttpError(404, "Application not found");

  const rows = await db
    .select()
    .from(notes)
    .where(eq(notes.applicationId, applicationId))
    .orderBy(desc(notes.createdAt), desc(notes.id));

  res.json(rows);
});

notesRouter.post("/applications/:applicationId/notes", async (req, res) => {
  const applicationId = requireId(req.params.applicationId);
  const data = noteInput.parse(req.body);

  try {
    const [created] = await db
      .insert(notes)
      .values({ ...data, applicationId })
      .returning();
    res.status(201).json(created);
  } catch (err) {
    if (pgErrorCode(err) === PG_FOREIGN_KEY_VIOLATION) {
      throw new HttpError(404, "Application not found");
    }
    throw err;
  }
});

notesRouter.delete("/notes/:id", async (req, res) => {
  const id = requireId(req.params.id);

  const [deleted] = await db
    .delete(notes)
    .where(eq(notes.id, id))
    .returning({ id: notes.id });

  if (!deleted) throw new HttpError(404, "Note not found");
  res.status(204).end();
});