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
export async function notify(studentId: string, type: NotificationType, message: string) {
  await connectToDatabase();
  await Notification.create({ studentId, type, message });

  if (process.env.RESEND_API_KEY) {
    await sendEmail(studentId, message);
  }
  if (process.env.TWILIO_ACCOUNT_SID) {
    await sendWhatsApp(studentId, message);
  }
}

async function sendEmail(studentId: string, message: string) {
  // TODO: plug in a real provider (e.g. Resend, SendGrid) here using RESEND_API_KEY.
  console.log(`[email stub] would email student ${studentId}: ${message}`);
}

async function sendWhatsApp(studentId: string, message: string) {
  // TODO: plug in Twilio/WhatsApp Business API here using TWILIO_ACCOUNT_SID.
  console.log(`[whatsapp stub] would message student ${studentId}: ${message}`);
}
