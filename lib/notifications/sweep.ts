import { connectToDatabase } from "@/lib/db/mongodb";
import { notify } from "@/lib/notifications/send";
import Notification from "@/models/Notification";
import BorrowTransaction from "@/models/BorrowTransaction";

/**
 * Finds ACTIVE transactions due soon or overdue and creates a notification for each,
 * skipping any transaction that already got one in the last 20 hours so re-running this
 * doesn't spam. Callers are responsible for their own authorization — this function does
 * none, since it's used both by an admin-only Server Action and by the cron route (which
 * authorizes via CRON_SECRET instead of a user session).
 */
export async function runDueSoonSweepCore() {
  await connectToDatabase();

  const now = new Date();
  const soon = new Date(now);
  soon.setDate(soon.getDate() + 3);
  const cutoff = new Date(now.getTime() - 20 * 60 * 60 * 1000);

  const candidates = await BorrowTransaction.find({
    status: "ACTIVE",
    dueDate: { $lte: soon },
  }).populate("studentId");

  let sent = 0;
  for (const txn of candidates) {
    const alreadyNotified = await Notification.findOne({
      studentId: txn.studentId._id,
      createdAt: { $gte: cutoff },
      message: { $regex: txn.transactionId },
    });
    if (alreadyNotified) continue;

    const overdue = txn.dueDate < now;
    const dueTodayFlag = txn.dueDate.toDateString() === now.toDateString();
    const type = overdue ? "OVERDUE" : dueTodayFlag ? "DUE_TODAY" : "DUE_SOON";
    const when = txn.dueDate.toLocaleDateString();
    const message = overdue
      ? `Overdue: return your book (txn ${txn.transactionId}), due ${when}.`
      : `Reminder: your book (txn ${txn.transactionId}) is due ${when}.`;

    await notify((txn.studentId as any)._id.toString(), type, message);
    sent++;
  }

  return { checked: candidates.length, sent };
}
