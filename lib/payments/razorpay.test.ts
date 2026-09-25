import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import crypto from "crypto";
import { isPaymentGatewayConfigured, createPaymentLink, verifyWebhookSignature } from "./razorpay";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
});

describe("isPaymentGatewayConfigured", () => {
  it("is false when the Razorpay keys are missing", () => {
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    expect(isPaymentGatewayConfigured()).toBe(false);
  });

  it("is true once both keys are set", () => {
    process.env.RAZORPAY_KEY_ID = "rzp_test_id";
    process.env.RAZORPAY_KEY_SECRET = "rzp_test_secret";
    expect(isPaymentGatewayConfigured()).toBe(true);
  });
});

describe("createPaymentLink", () => {
  it("throws a clear, catchable error when the gateway isn't configured — never hits the network", async () => {
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;

    await expect(
      createPaymentLink({
        amountRupees: 50,
        description: "Overdue fine",
        studentName: "Test Student",
        studentEmail: "test@example.com",
        studentPhone: "9876543210",
        referenceId: "FINE-1",
        callbackUrl: "https://example.com/student/fines",
      })
    ).rejects.toThrow(/not configured/i);
  });

  it("sends amount in paise, Basic auth, and the fine id as reference_id", async () => {
    process.env.RAZORPAY_KEY_ID = "rzp_test_id";
    process.env.RAZORPAY_KEY_SECRET = "rzp_test_secret";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "plink_123", short_url: "https://rzp.io/i/abc123" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await createPaymentLink({
      amountRupees: 15,
      description: "Overdue fine",
      studentName: "Test Student",
      studentEmail: "test@example.com",
      studentPhone: "9876543210",
      referenceId: "FINE-42",
      callbackUrl: "https://example.com/student/fines",
    });

    expect(result).toEqual({ id: "plink_123", shortUrl: "https://rzp.io/i/abc123" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.razorpay.com/v1/payment_links");

    const expectedAuth = Buffer.from("rzp_test_id:rzp_test_secret").toString("base64");
    expect(init.headers.Authorization).toBe(`Basic ${expectedAuth}`);

    const body = JSON.parse(init.body);
    expect(body.amount).toBe(1500); // 15 rupees -> 1500 paise
    expect(body.currency).toBe("INR");
    expect(body.reference_id).toBe("FINE-42");
    expect(body.customer.email).toBe("test@example.com");
  });

  it("surfaces a Razorpay API error instead of swallowing it", async () => {
    process.env.RAZORPAY_KEY_ID = "rzp_test_id";
    process.env.RAZORPAY_KEY_SECRET = "rzp_test_secret";

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => "Unauthorized" })
    );

    await expect(
      createPaymentLink({
        amountRupees: 15,
        description: "Overdue fine",
        studentName: "Test Student",
        studentEmail: "test@example.com",
        studentPhone: "9876543210",
        referenceId: "FINE-42",
        callbackUrl: "https://example.com/student/fines",
      })
    ).rejects.toThrow(/401/);
  });
});

describe("verifyWebhookSignature", () => {
  beforeEach(() => {
    process.env.RAZORPAY_WEBHOOK_SECRET = "test-webhook-secret";
  });

  it("accepts a correctly signed body", () => {
    const body = JSON.stringify({ event: "payment_link.paid" });
    const signature = crypto.createHmac("sha256", "test-webhook-secret").update(body).digest("hex");
    expect(verifyWebhookSignature(body, signature)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const body = JSON.stringify({ event: "payment_link.paid" });
    const signature = crypto.createHmac("sha256", "test-webhook-secret").update(body).digest("hex");
    const tamperedBody = JSON.stringify({ event: "payment_link.paid", amount: 999999 });
    expect(verifyWebhookSignature(tamperedBody, signature)).toBe(false);
  });

  it("rejects a signature signed with the wrong secret", () => {
    const body = JSON.stringify({ event: "payment_link.paid" });
    const wrongSignature = crypto.createHmac("sha256", "someone-elses-secret").update(body).digest("hex");
    expect(verifyWebhookSignature(body, wrongSignature)).toBe(false);
  });

  it("rejects when there's no signature header", () => {
    expect(verifyWebhookSignature("{}", null)).toBe(false);
  });

  it("rejects when the webhook secret isn't configured", () => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    const body = "{}";
    const signature = crypto.createHmac("sha256", "irrelevant").update(body).digest("hex");
    expect(verifyWebhookSignature(body, signature)).toBe(false);
  });
});
