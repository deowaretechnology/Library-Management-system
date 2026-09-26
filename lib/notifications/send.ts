import { connectToDatabase } from "@/lib/db/mongodb";
import Notification, { NotificationType } from "@/models/Notification";

/**
 * Every notification is always recorded in-app (Notification collection), which is what
 * powers /student/notifications. Email/SMS/WhatsApp are separate, optional channels that
 * only fire if their provider env vars are set — this keeps the business logic (who gets
 * notified, and when) decoupled from which provider sends it, per architecture doc §35.
 *
 * NONE of the external channels are wired to a real provider yet — sendEmail/sendWhatsApp
 * below are stubs that log what WOULD be sent. Plug in Resend/SendGrid/Twilio by filling
 * in the marked spot and setting the matching env var.
 */
export async function notify(studentId: string, type: NotificationType, message: string, refId?: string) {
  await connectToDatabase();
  await Notification.create({ studentId, type, message, ...(refId ? { refId } : {}) });

  if (process.env.RESEND_API_KEY) {
    await sendEmail(studentId, message);
  }
  if (process.env.TWILIO_ACCOUNT_SID) {
    await sendWhatsApp(studentId, message);
  }
}

/**
 * Bulk version for the daily sweep: ONE insertMany instead of one round trip per notice
 * (thousands of sequential writes used to push the cron past its time limit).
 */
export async function notifyMany(
  items: { studentId: string; type: NotificationType; message: string; refId?: string }[]
) {
  if (items.length === 0) return 0;
  await connectToDatabase();
  const inserted = await Notification.insertMany(items, { ordered: false });

  if (process.env.RESEND_API_KEY || process.env.TWILIO_ACCOUNT_SID) {
    for (const item of items) {
      if (process.env.RESEND_API_KEY) await sendEmail(item.studentId, item.message);
      if (process.env.TWILIO_ACCOUNT_SID) await sendWhatsApp(item.studentId, item.message);
    }
  }
  return inserted.length;
}

async function sendEmail(studentId: string, message: string) {
  // TODO: plug in a real provider (e.g. Resend, SendGrid) here using RESEND_API_KEY.
  console.log(`[email stub] would email student ${studentId}: ${message}`);
}

async function sendWhatsApp(studentId: string, message: string) {
  // TODO: plug in Twilio/WhatsApp Business API here using TWILIO_ACCOUNT_SID.
  console.log(`[whatsapp stub] would message student ${studentId}: ${message}`);
}
