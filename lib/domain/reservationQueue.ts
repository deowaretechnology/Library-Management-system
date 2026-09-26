import type { ClientSession, Types } from "mongoose";
import BookCopy from "@/models/BookCopy";
import Reservation from "@/models/Reservation";

/**
 * NOT a "use server" module on purpose — these helpers do no auth of their own and must
 * only ever be called from server code that already authorized the caller. (Anything
 * exported from a "use server" file becomes a publicly callable endpoint.)
 */

/**
 * A copy just became free (returned, a hold expired/was cancelled, restored from repair,
 * or the student it was held for got a different copy). Hand it to the longest-waiting
 * PENDING reservation for that title if there is one — marking it READY and the copy
 * RESERVED — otherwise put it back on the shelf as AVAILABLE.
 *
 * The reservation is claimed with a single findOneAndUpdate (status: PENDING → READY), so
 * two copies freed at the same moment can never both be handed to the same student.
 *
 * Returns the Student _id (string) to notify with RESERVATION_READY, or null. The caller
 * sends the notification AFTER its transaction commits.
 */
export async function offerCopyToQueue(
  copyId: Types.ObjectId | string,
  sanityBookId: string,
  session?: ClientSession
): Promise<{ studentId: string; reservationId: string } | null> {
  const next = await Reservation.findOneAndUpdate(
    { sanityBookId, status: "PENDING" },
    { $set: { status: "READY", bookCopyId: copyId, readyAt: new Date() } },
    { sort: { requestedAt: 1 }, new: true, session }
  );

  if (next) {
    await BookCopy.updateOne({ _id: copyId }, { $set: { status: "RESERVED" } }, { session });
    return { studentId: next.studentId.toString(), reservationId: next.reservationId };
  }

  await BookCopy.updateOne({ _id: copyId }, { $set: { status: "AVAILABLE" } }, { session });
  return null;
}

/**
 * A copy that was being HELD for a READY reservation can no longer serve it (the copy was
 * marked lost/damaged/repair). Put the reservation back in the queue as PENDING — it keeps
 * its original requestedAt, so it stays at the front of the line for the next copy.
 */
export async function requeueHoldOnCopy(copyId: Types.ObjectId | string, session?: ClientSession) {
  await Reservation.updateMany(
    { bookCopyId: copyId, status: "READY" },
    { $set: { status: "PENDING" }, $unset: { bookCopyId: "", readyAt: "" } },
    { session }
  );
}
