import { describe, it, expect } from "vitest";
import { evaluateClearance } from "@/lib/domain/clearance";

describe("evaluateClearance", () => {
  it("clears a student with no active borrows and no pending fines", () => {
    const result = evaluateClearance({ activeBorrowCount: 0, pendingFineCount: 0 });
    expect(result.cleared).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it("blocks clearance for active borrows, with a reason", () => {
    const result = evaluateClearance({ activeBorrowCount: 2, pendingFineCount: 0 });
    expect(result.cleared).toBe(false);
    expect(result.reasons).toContain("2 book(s) still borrowed");
  });

  it("blocks clearance for pending fines, with a reason", () => {
    const result = evaluateClearance({ activeBorrowCount: 0, pendingFineCount: 1 });
    expect(result.cleared).toBe(false);
    expect(result.reasons).toContain("1 unpaid fine(s)");
  });

  it("reports both reasons when both apply", () => {
    const result = evaluateClearance({ activeBorrowCount: 1, pendingFineCount: 1 });
    expect(result.cleared).toBe(false);
    expect(result.reasons).toHaveLength(2);
  });
});
