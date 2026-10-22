import express from "express";
import cookieParser from "cookie-parser";
import { requireAuth } from "./auth/middleware.js";
import { pool } from "./db/client.js";
import { errorHandler, notFoundHandler } from "./errors.js";
import { applicationsRouter } from "./routes/applications.js";
import { authRouter } from "./routes/auth.js";
import { companiesRouter } from "./routes/companies.js";
import { contactsRouter } from "./routes/contacts.js";
import { notesRouter } from "./routes/notes.js";

export const app = express();

app.disable("x-powered-by");

app.use(express.json());
app.use(cookieParser());

// Public routes
app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", database: "up" });
  } catch (err) {
    console.error("Database health check failed:", err);
    res.status(503).json({ status: "error", database: "down" });
  }
});

app.use(authRouter);

// Everything below this line requires a logged-in user
app.use(requireAuth);

app.use("/companies", companiesRouter);
app.use("/applications", applicationsRouter);
app.use(contactsRouter);
app.use(notesRouter);

app.use(notFoundHandler);
app.use(errorHandler);