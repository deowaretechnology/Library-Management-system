/** Whole days between dueDate and returnDate, floored at 0 (never negative). */
export function calculateOverdueDays(dueDate: Date, returnDate: Date): number {
  const ms = returnDate.getTime() - dueDate.getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

/** Fine amount for a given number of overdue days, capped at the library's max fine. */
export function calculateFineAmount(overdueDays: number, finePerDay: number, maxFineAmount: number): number {
  if (overdueDays <= 0) return 0;
  return Math.min(overdueDays * finePerDay, maxFineAmount);
}
