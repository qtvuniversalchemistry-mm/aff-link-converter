// API: POST /api/convert  body: { "url": "..." }   (hoặc GET /api/convert?url=...)
import config from "../config.js";
import { convertLink } from "../lib/convert.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, code: "METHOD", message: "Method not allowed" });
  }

  let input = req.method === "GET" ? req.query?.url : req.body?.url;
  if (req.method === "POST" && typeof req.body === "string") {
    try {
      input = JSON.parse(req.body).url;
    } catch {
      input = req.body;
    }
  }

  if (typeof input !== "string" || !input.trim()) {
    return res.status(400).json({ ok: false, code: "NO_URL", message: "Bạn chưa dán link." });
  }

  try {
    const result = await convertLink(input, config);
    return res.status(200).json(result);
  } catch (err) {
    console.error("convert error", err);
    return res.status(500).json({ ok: false, code: "SERVER", message: "Có lỗi xảy ra, vui lòng thử lại." });
  }
}
