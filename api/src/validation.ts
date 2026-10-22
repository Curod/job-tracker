import { z } from "zod";

export const MAX_DB_ID = 2_147_483_647;
export const ID_PATTERN = /^[1-9]\d{0,9}$/;

export const idSchema = z.number().int().min(1).max(MAX_DB_ID);

export const idStringSchema = z.string().regex(ID_PATTERN).transform(Number).pipe(idSchema);

export const httpUrl = z.url({ protocol: /^https?$/ });