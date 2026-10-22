import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { applications, companies } from "../db/schema.js";

export function ownedCompanyIds(userId: number) {
  return db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.userId, userId));
}

export function ownedApplicationIds(userId: number) {
  return db
    .select({ id: applications.id })
    .from(applications)
    .innerJoin(companies, eq(applications.companyId, companies.id))
    .where(eq(companies.userId, userId));
}

export async function findOwnedCompany(userId: number, companyId: number) {
  const [company] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(and(eq(companies.id, companyId), eq(companies.userId, userId)));
  return company;
}

export async function findOwnedApplication(userId: number, applicationId: number) {
  const [application] = await db
    .select({ id: applications.id })
    .from(applications)
    .innerJoin(companies, eq(applications.companyId, companies.id))
    .where(and(eq(applications.id, applicationId), eq(companies.userId, userId)));
  return application;
}