import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/payments/razorpay";
import { connectToDatabase } from "@/lib/db/mongodb";
import Fine from "@/models/Fine";

/**
 * Configure this URL (https://yourdomain.com/api/webhooks/razorpay) in the Razorpay
 * dashboard under Settings → Webhooks, subscribed to the "payment_link.paid" event, with
 * RAZORPAY_WEBHOOK_SECRET set to the secret shown there.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody);

  if (event.event === "payment_link.paid") {
    const paymentLink = event.payload?.payment_link?.entity;
    const payment = event.payload?.payment?.entity;
    const fineId = paymentLink?.reference_id;

    if (fineId) {
      await connectToDatabase();
      await Fine.updateOne(
        { fineId, status: { $in: ["PENDING", "PARTIALLY_PAID"] } },
        {
          $set: {
            status: "PAID",
            paidAt: new Date(),
            paymentMethod: "razorpay",
            paymentReference: payment?.id ?? paymentLink?.id,
          },
        }
      );
    }
  }

  return NextResponse.json({ received: true });
}
