import { connectToDatabase } from "@/lib/db/mongodb";
import { notify, notifyMany } from "@/lib/notifications/send";
import Notification, { NotificationType } from "@/models/Notification";
import BorrowTransaction from "@/models/BorrowTransaction";
import Reservation from "@/models/Reservation";
import LibrarySettings from "@/models/LibrarySettings";
import LibraryVisit from "@/models/LibraryVisit";
import { offerCopyToQueue } from "@/lib/domain/reservationQueue";
import { formatIstDate, istDayKey, startOfIstDay } from "@/lib/domain/dates";

/**
 * Daily maintenance, used both by an admin-only Server Action and by the cron route (which
 * authorizes via CRON_SECRET instead of a user session). Callers are responsible for their
 * own authorization — this function does none.
 *
 *  1. Due-soon / due-today / overdue reminders — de-duplicated per transaction per ~day.
 *  2. Expire READY reservation holds nobody picked up, and pass the copy to the next student
 *     (previously nothing ever expired, so one no-show blocked a copy forever).
 *  3. Close gate visits left open from previous days (student left without an exit scan).
 */
export async function runDueSoonSweepCore() {
  await connectToDatabase();

  const now = new Date();
  const soon = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const cutoff = new Date(now.getTime() - 20 * 60 * 60 * 1000);

  // ---- 1. Reminders (batched: 2 reads + 1 bulk insert, regardless of loan count) ----
  const candidates = await BorrowTransaction.find({ status: "ACTIVE", dueDate: { $lte: soon } })
    .select("transactionId studentId dueDate")
    .lean<{ transactionId: string; studentId: any; dueDate: Date }[]>();

  const recentlyNotified = new Set(
    (
      await Notification.find({
        refId: { $in: candidates.map((c) => c.transactionId) },
        createdAt: { $gte: cutoff },
      })
        .select("refId")
        .lean<{ refId: string }[]>()
    ).map((n) => n.refId)
  );

  const todayKey = istDayKey(now);
  const toSend = candidates
    .filter((txn) => !recentlyNotified.has(txn.transactionId))
    .map((txn) => {
      const due = new Date(txn.dueDate);
      const overdue = due < now;
      const dueToday = istDayKey(due) === todayKey;
      const type: NotificationType = overdue ? "OVERDUE" : dueToday ? "DUE_TODAY" : "DUE_SOON";
      const when = formatIstDate(due);
      const message = overdue
        ? `Overdue: return your book (txn ${txn.transactionId}), due ${when}.`
        : `Reminder: your book (txn ${txn.transactionId}) is due ${when}.`;
      return { studentId: txn.studentId.toString(), type, message, refId: txn.transactionId };
    });

  let sent = 0;
  // Chunked so one huge batch can't exceed the 16MB command limit.
  for (let i = 0; i < toSend.length; i += 1000) {
    sent += await notifyMany(toSend.slice(i, i + 1000));
  }

  // ---- 2. Expire stale READY holds ----
  const settings: any = (await LibrarySettings.findOne().select("reservationHoldDays").lean()) ?? {};
  const holdDays = Math.max(1, Number(settings.reservationHoldDays ?? 3));
  const holdCutoff = new Date(now.getTime() - holdDays * 24 * 60 * 60 * 1000);
  const staleHolds = await Reservation.find({ status: "READY", readyAt: { $lt: holdCutoff } })
    .select("_id")
    .limit(500)
    .lean<{ _id: any }[]>();

  let expiredHolds = 0;
  for (const { _id } of staleHolds) {
    // Atomic transition so a concurrent pickup/issue of the same hold can't be expired.
    const expired = await Reservation.findOneAndUpdate(
      { _id, status: "READY" },
      { $set: { status: "EXPIRED", cancelledAt: now } },
      { new: false }
    );
    if (!expired) continue;
    expiredHolds++;
    await notify(
      expired.studentId.toString(),
      "RESERVATION_EXPIRED",
      `Your reservation hold expired after ${holdDays} day(s) without pickup. Reserve again if you still need the book.`
    ).catch(() => {});
    if (expired.bookCopyId) {
      const next = await offerCopyToQueue(expired.bookCopyId, expired.sanityBookId).catch(() => null);
      if (next) await notify(next.studentId, "RESERVATION_READY", "Your reserved book is ready for pickup at the counter.").catch(() => {});
    }
  }

  // ---- 3. Close yesterday's (and older) open gate visits ----
  const closedVisits = await LibraryVisit.updateMany(
    { status: "INSIDE", entryDate: { $lt: startOfIstDay(now) } },
    { $set: { status: "EXITED", exitMethod: "auto-close (no exit scan)" } }
  );

  return { checked: candidates.length, sent, expiredHolds, closedVisits: closedVisits.modifiedCount };
}
