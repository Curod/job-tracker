import { describe, expect, it } from "vitest";
import { canTransition } from "../src/domain/status.js";

describe("canTransition", () => {
  it("allows moving forward one stage", () => {
    expect(canTransition("applied", "screening")).toBe(true);
  });

  it("allows skipping stages forward", () => {
    expect(canTransition("applied", "interview")).toBe(true);
  });

  it("rejects moving backwards", () => {
    expect(canTransition("interview", "screening")).toBe(false);
  });

  it("allows rejection from any active stage", () => {
    for (const stage of ["applied", "screening", "interview"] as const) {
      expect(canTransition(stage, "rejected")).toBe(true);
    }
  });

  it("treats offer and rejected as final", () => {
    expect(canTransition("offer", "rejected")).toBe(false);
    expect(canTransition("rejected", "applied")).toBe(false);
  });

  it("rejects a move to the same stage", () => {
    expect(canTransition("applied", "applied")).toBe(false);
  });
});