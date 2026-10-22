import { HttpError } from "./errors.js";
import { ID_PATTERN, MAX_DB_ID } from "./validation.js";

// pg codrs
export const PG_FOREIGN_KEY_VIOLATION = "23503";
export const PG_RESTRICT_VIOLATION = "23001";
export const PG_UNIQUE_VIOLATION = "23505";

export function parseId(value: string): number | null {
  if (!ID_PATTERN.test(value)) return null;
  const id = Number(value);
  return id <= MAX_DB_ID ? id : null;
}

export function requireId(value: string): number {
  const id = parseId(value);
  if (id === null) throw new HttpError(400, "Invalid id");
  return id;
}

export function pgErrorCode(err: unknown): string | undefined {
  const e = err as { code?: unknown; cause?: { code?: unknown } } | null;
  const code = e?.code ?? e?.cause?.code;
  return typeof code === "string" ? code : undefined;
}