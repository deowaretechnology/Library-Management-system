/**
 * Thin wrapper around Razorpay's Payment Links API (https://razorpay.com/docs/payment-links/apis/).
 * Chosen over the Orders + Checkout.js flow because it needs no client-side script — we
 * just redirect the student to a hosted payment page and get notified by webhook.
 *
 * Requires RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET in the environment. Without them,
 * createPaymentLink throws a clear "not configured" error rather than failing silently —
 * callers should catch that and tell the student to pay at the counter instead.
 */
const RAZORPAY_API = "https://api.razorpay.com/v1/payment_links";

export function isPaymentGatewayConfigured() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export async function createPaymentLink(opts: {
  amountRupees: number;
  description: string;
  studentName: string;
  studentEmail: string;
  studentPhone: string;
  referenceId: string; // our fineId — comes back on the webhook so we know what to mark paid
  callbackUrl: string;
}): Promise<{ id: string; shortUrl: string }> {
  if (!isPaymentGatewayConfigured()) {
    throw new Error("Online payment is not configured — RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET are not set.");
  }

  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");

  const res = await fetch(RAZORPAY_API, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: Math.round(opts.amountRupees * 100), // paise
      currency: "INR",
      description: opts.description,
      reference_id: opts.referenceId,
      customer: {
        name: opts.studentName,
        email: opts.studentEmail,
        contact: opts.studentPhone,
      },
      notify: { sms: false, email: false },
      callback_url: opts.callbackUrl,
      callback_method: "get",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Razorpay payment link creation failed: ${res.status} ${body}`);
  }

  const data = await res.json();
  return { id: data.id, shortUrl: data.short_url };
}

/** Verifies an incoming Razorpay webhook signature. Returns false on any mismatch. */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature || !process.env.RAZORPAY_WEBHOOK_SECRET) return false;
  const crypto = require("crypto") as typeof import("crypto");
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false; // length mismatch etc.
  }
}
