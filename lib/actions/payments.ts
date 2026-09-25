"use server";

import { redirect } from "next/navigation";
import { connectToDatabase } from "@/lib/db/mongodb";
import { requireRole, assertOwnStudentRecord } from "@/lib/auth/requireRole";
import { createPaymentLink, isPaymentGatewayConfigured } from "@/lib/payments/razorpay";
import Fine from "@/models/Fine";
import Student from "@/models/Student";

export async function initiateFinePaymentAction(formData: FormData) {
  const session = await requireRole(["STUDENT"]);
  const fineId = String(formData.get("fineId"));
  const studentIdInput = String(formData.get("studentId"));
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

  let link: { id: string; shortUrl: string };
  try {
    link = await createPaymentLink({
      amountRupees: fine!.amount,
      description: fine!.reason,
      studentName: student!.name,
      studentEmail: student!.email,
      studentPhone: student!.phone,
      referenceId: fine!.fineId,
      callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/student/fines`,
    });
  } catch (err) {
    redirect(`/student/fines?error=${encodeURIComponent((err as Error).message)}`);
  }

  fine!.paymentLinkId = link.id;
  fine!.paymentLinkUrl = link.shortUrl;
  await fine!.save();

  redirect(link.shortUrl);
}
