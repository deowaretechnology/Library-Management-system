"use server";

import { redirect } from "next/navigation";
import { connectToDatabase } from "@/lib/db/mongodb";
import { requireRole, assertOwnStudentRecord } from "@/lib/auth/requireRole";
import { createPaymentLink, isPaymentGatewayConfigured } from "@/lib/payments/razorpay";
import Fine from "@/models/Fine";
import Student from "@/models/Student";

export async function initiateFinePaymentAction(formData: FormData) {
  const session = await requireRole(["STUDENT"]);
  const fineId = String(formData.get("fineId") ?? "");
  const studentIdInput = String(formData.get("studentId") ?? "");
  assertOwnStudentRecord(session, studentIdInput);

  if (!isPaymentGatewayConfigured()) {
    redirect(`/student/fines?error=${encodeURIComponent("Online payment isn't set up yet — please pay at the library counter.")}`);
  }

  await connectToDatabase();
  const [fine, student] = await Promise.all([
    Fine.findOne({ fineId }),
    Student.findOne({ studentId: studentIdInput }),
  ]);
  if (!fine || !student) redirect(`/student/fines?error=${encodeURIComponent("Fine not found.")}`);
  if (fine!.studentId.toString() !== student!._id.toString()) {
    redirect(`/student/fines?error=${encodeURIComponent("That fine doesn't belong to you.")}`);
  }
  if (fine!.status !== "PENDING" && fine!.status !== "PARTIALLY_PAID") {
    redirect(`/student/fines?error=${encodeURIComponent("This fine is already settled.")}`);
  }

  // Reuse the existing link while it's still for the current outstanding amount —
  // Razorpay rejects a second link with the same reference_id, so every retry after an
  // abandoned first attempt used to fail.
  if (fine!.paymentLinkUrl && fine!.paymentLinkAmount === fine!.amount) {
    redirect(fine!.paymentLinkUrl);
  }

  // fineIds never contain "_", so the webhook can recover the fineId with split("_")[0].
  const referenceId = `${fine!.fineId}_${Date.now().toString(36)}`;
  let link: { id: string; shortUrl: string };
  try {
    link = await createPaymentLink({
      amountRupees: fine!.amount,
      description: fine!.reason,
      studentName: student!.name,
      studentEmail: student!.email,
      studentPhone: student!.phone,
      referenceId,
      callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/student/fines`,
    });
  } catch (err) {
    // Log the gateway's details server-side; never show raw Razorpay responses to students.
    console.error("[payments] payment link creation failed:", err);
    redirect(`/student/fines?error=${encodeURIComponent("Couldn't start the online payment right now — please try again, or pay at the library counter.")}`);
  }

  await Fine.updateOne(
    { _id: fine!._id },
    { $set: { paymentLinkId: link.id, paymentLinkUrl: link.shortUrl, paymentLinkRef: referenceId, paymentLinkAmount: fine!.amount } }
  );

  redirect(link.shortUrl);
}
