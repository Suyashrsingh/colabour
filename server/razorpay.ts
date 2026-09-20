import Razorpay from "razorpay";
import crypto from "crypto";
import fs from "fs";
import path from "path";

// Load environment variables from .env if not present
function loadEnv() {
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim();
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  } catch (e) {
    console.warn("Could not read .env file:", e);
  }
}

loadEnv();

export function getRazorpayKeys() {
  loadEnv();
  const key_id = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || "rzp_test_Tdvd2AkbOubLSt";
  const key_secret = process.env.RAZORPAY_KEY_SECRET || "eG9xocnkoqud5CAerTI4Nqv6";
  return { key_id, key_secret };
}

export function getRazorpayInstance() {
  const { key_id, key_secret } = getRazorpayKeys();
  if (!key_id || !key_secret) {
    throw new Error("Razorpay credentials (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET) not configured");
  }
  return new Razorpay({
    key_id,
    key_secret,
  });
}

/**
 * STEP 1: BACKEND - Create Order
 * - Endpoint: POST /api/create-order
 * - Call Razorpay API: POST https://api.razorpay.com/v1/orders
 * - Request: { amount (paise), currency, receipt }
 * - Return: { order_id, amount, currency }
 * - Minimum amount: 100 paise
 */
export async function handleCreateOrder(reqBody: {
  amount?: number;
  currency?: string;
  receipt?: string;
  notes?: Record<string, string>;
}) {
  const { amount, currency = "INR", receipt = `rcpt_${Date.now().toString().slice(-8)}`, notes } = reqBody;

  // Validate amount >= 100 paise (₹1)
  if (!amount || typeof amount !== "number" || amount < 100) {
    return {
      status: 400,
      body: { error: "Invalid amount. Minimum amount is 100 paise (₹1.00)." },
    };
  }

  try {
    const razorpay = getRazorpayInstance();
    const order = await razorpay.orders.create({
      amount: Math.round(amount),
      currency,
      receipt,
      notes: notes || {},
    });

    return {
      status: 200,
      body: {
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt,
      },
    };
  } catch (err: any) {
    console.error("Razorpay order creation error:", err);
    if (err?.statusCode === 401) {
      return {
        status: 401,
        body: { error: "Razorpay authentication failed. Please verify API key and secret." },
      };
    }
    return {
      status: 500,
      body: {
        error: err?.error?.description || err?.message || "Failed to create Razorpay order",
      },
    };
  }
}

/**
 * STEP 3: BACKEND - Verify Signature
 * - Endpoint: POST /api/verify-payment
 * - Algorithm: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
 * - Compare generated signature with razorpay_signature
 * - Return success only if signatures match
 */
export function handleVerifyPayment(reqBody: {
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
}) {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = reqBody;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return {
      status: 400,
      body: { error: "Missing required payment verification fields: razorpay_order_id, razorpay_payment_id, razorpay_signature" },
    };
  }

  const { key_secret } = getRazorpayKeys();
  if (!key_secret) {
    return {
      status: 500,
      body: { error: "RAZORPAY_KEY_SECRET is not configured on the server" },
    };
  }

  try {
    const expectedSignature = crypto
      .createHmac("sha256", key_secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const expectedBuf = Buffer.from(expectedSignature, "utf-8");
    const receivedBuf = Buffer.from(razorpay_signature, "utf-8");

    const isMatch =
      expectedBuf.length === receivedBuf.length &&
      crypto.timingSafeEqual(expectedBuf, receivedBuf);

    if (!isMatch) {
      return {
        status: 400,
        body: {
          success: false,
          error: "Invalid payment signature. Verification failed.",
        },
      };
    }

    return {
      status: 200,
      body: {
        success: true,
        message: "Payment signature verified successfully",
        order_id: razorpay_order_id,
        payment_id: razorpay_payment_id,
      },
    };
  } catch (err: any) {
    console.error("Razorpay signature verification error:", err);
    return {
      status: 400,
      body: { success: false, error: "Signature verification failed: " + (err?.message || "Unknown error") },
    };
  }
}
