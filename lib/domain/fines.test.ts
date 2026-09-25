import { describe, it, expect } from "vitest";
import { calculateOverdueDays, calculateFineAmount } from "@/lib/domain/fines";

describe("calculateOverdueDays", () => {
  it("returns 0 when returned before the due date", () => {
    const due = new Date("2026-09-30T00:00:00Z");
    const returned = new Date("2026-09-28T00:00:00Z");
    expect(calculateOverdueDays(due, returned)).toBe(0);
  });

  it("returns 0 when returned exactly on the due date", () => {
    const due = new Date("2026-09-30T00:00:00Z");
    expect(calculateOverdueDays(due, due)).toBe(0);
  });

  it("returns whole days late, rounding up a partial day", () => {
    const due = new Date("2026-09-30T00:00:00Z");
    const returned = new Date("2026-10-03T02:00:00Z"); // 3 days + 2 hours late
    expect(calculateOverdueDays(due, returned)).toBe(4);
  });

  it("returns exact whole days when there's no partial day", () => {
    const due = new Date("2026-09-30T00:00:00Z");
    const returned = new Date("2026-10-03T00:00:00Z");
    expect(calculateOverdueDays(due, returned)).toBe(3);
  });
});

describe("calculateFineAmount", () => {
  it("is 0 for 0 overdue days", () => {
    expect(calculateFineAmount(0, 5, 500)).toBe(0);
  });

  it("multiplies overdue days by the daily rate", () => {
    expect(calculateFineAmount(3, 5, 500)).toBe(15);
  });

  it("caps at the library's maximum fine amount", () => {
    expect(calculateFineAmount(200, 5, 500)).toBe(500);
  });

  it("never goes negative for a negative day count", () => {
    expect(calculateFineAmount(-3, 5, 500)).toBe(0);
  });
});
