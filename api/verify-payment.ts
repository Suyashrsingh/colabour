import { handleVerifyPayment } from "../backend/razorpay.ts";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const result = handleVerifyPayment(body);
    return res.status(result.status).json(result.body);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Internal server error" });
  }
}
