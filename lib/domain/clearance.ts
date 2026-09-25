export interface ClearanceCheck {
  activeBorrowCount: number;
  pendingFineCount: number;
}

export interface ClearanceResult {
  cleared: boolean;
  reasons: string[];
}

/** CLEARED only if the student has zero active borrows and zero pending/partial fines. */
export function evaluateClearance({ activeBorrowCount, pendingFineCount }: ClearanceCheck): ClearanceResult {
  const reasons: string[] = [];
  if (activeBorrowCount > 0) reasons.push(`${activeBorrowCount} book(s) still borrowed`);
  if (pendingFineCount > 0) reasons.push(`${pendingFineCount} unpaid fine(s)`);
  return { cleared: reasons.length === 0, reasons };
}
