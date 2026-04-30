/**
 * /api/unsubscribe — Vercel Serverless Function
 * Completes an unsubscribe using a mail recipient id from newsletter links.
 *
 * GET /api/unsubscribe?r={recipient_id}
 */

const TRACKER_BASE =
  process.env.MAIL_TRACKER_BASE_URL ||
  "https://yxndmpwqvdatkujcukdv.supabase.co/functions/v1/mail-tracker";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const recipientId = String(req.query.r || "").trim();
  if (!recipientId) return res.status(400).json({ error: "Missing recipient id" });

  try {
    const url = new URL(TRACKER_BASE);
    url.searchParams.set("action", "confirm_unsubscribe");
    url.searchParams.set("r", recipientId);

    const upstream = await fetch(url.toString(), { method: "GET" });
    const body = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: typeof body?.error === "string" ? body.error : "Failed to unsubscribe",
      });
    }

    return res.status(200).json({ ok: true });
  } catch {
    return res.status(500).json({ error: "Failed to unsubscribe" });
  }
}
