import { applicationStatus } from "../db/schema.js";

export type ApplicationStatus = (typeof applicationStatus.enumValues)[number];

const stageOrder: Record<ApplicationStatus, number> = {
  applied: 0,
  screening: 1,
  interview: 2,
  offer: 3,
  rejected: 4,
};

export function canTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
  if (from === to) return false;
  if (from === "offer" || from === "rejected") return false;
  if (to === "rejected") return true;
  return stageOrder[to] > stageOrder[from];
}