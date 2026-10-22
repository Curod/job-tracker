import express from "express";
import { pool } from "./db/client.js";
import { companiesRouter } from "./routes/companies.js";
import { applicationsRouter } from "./routes/applications.js";
import { contactsRouter } from "./routes/contacts.js";
import { notesRouter } from "./routes/notes.js";
import { errorHandler, notFoundHandler } from "./errors.js";
import { authRouter } from "./routes/auth.js";
import cookieParser from "cookie-parser";


export const app = express();

app.use(express.json());
app.use(cookieParser());

app.use(express.json());

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
app.use("/companies", companiesRouter);
app.use("/applications", applicationsRouter);
app.use(contactsRouter);
app.use(notesRouter);

app.use(notFoundHandler);
app.use(errorHandler);