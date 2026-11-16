// =====================================================================
//  BỘ MỞ LINK RÚT GỌN – chạy trên Cloudflare Workers (gói miễn phí)
//  Việc 1: nhận link rút gọn Shopee/TikTok, đi theo chuyển hướng, trả lại link đầy đủ.
//  Việc 2 (tùy chọn): tạo link rút gọn s.shopee.vn/... chính thức qua Shopee Affiliate Open API.
//    Cần 2 biến bí mật trong Cloudflare: SHOPEE_APP_ID và SHOPEE_SECRET
//    (KHÔNG dán khóa vào file này). Chưa có thì web tự dùng link dài.
//  Không lưu link. Cách cài: xem README.md, mục "Bật đọc link rút gọn".
// =====================================================================

const ALLOWED = [/(^|\.)shopee\.vn$/, /(^|\.)shp\.ee$/, /(^|\.)shope\.ee$/, /(^|\.)tiktok\.com$/];
const PRODUCT_HINT = /(?:[-/.]i\.\d+\.\d+|\/product\/\d+|\/pdp\/)/;
const MAX_REDIRECTS = 6;
const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

const allowed = (u) => (u.protocol === "https:" || u.protocol === "http:") && ALLOWED.some((re) => re.test(u.hostname.toLowerCase()));

function reply(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Cache-Control": "no-store",
    },
  });
}

function linksInHtml(html) {
  const text = html.replace(/\\\//g, "/").replace(/&amp;/g, "&");
  const found = text.match(/https?:\/\/(?:[a-z0-9-]+\.)*(?:shopee\.vn|tiktok\.com)\/[^\s"'<>\\]+/gi) || [];
  return [...new Set(found)].filter((u) => PRODUCT_HINT.test(u)).slice(0, 20);
}

const SHOPEE_API = "https://open-api.affiliate.shopee.vn/graphql";

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Tạo link rút gọn chính thức của Shopee Affiliate (giống nút "Lấy link" trong Custom Link)
async function shorten(originUrl, sub, env) {
  let origin;
  try {
    origin = new URL(originUrl);
  } catch {
    return reply({ ok: false, error: "bad_url" }, 400);
  }
  if (origin.protocol !== "https:" || !/(^|\.)shopee\.vn$/.test(origin.hostname.toLowerCase())) {
    return reply({ ok: false, error: "domain" }, 400);
  }
  const appId = env && env.SHOPEE_APP_ID;
  const secret = env && env.SHOPEE_SECRET;
  if (!appId || !secret) return reply({ ok: false, error: "not_configured" });

  const subIds = (sub || "").split(",").map((s) => s.replace(/[^A-Za-z0-9]/g, "")).filter(Boolean).slice(0, 5);
  const query =
    "mutation{generateShortLink(input:{originUrl:" + JSON.stringify(origin.href) +
    ",subIds:" + JSON.stringify(subIds) + "}){shortLink}}";
  const payload = JSON.stringify({ query });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = await sha256Hex(appId + timestamp + payload + secret);

  let data;
  try {
    const res = await fetch(SHOPEE_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`,
      },
      body: payload,
      signal: AbortSignal.timeout(8000),
    });
    data = await res.json();
  } catch {
    return reply({ ok: false, error: "shopee_unreachable" }, 502);
  }
  const shortLink = data && data.data && data.data.generateShortLink && data.data.generateShortLink.shortLink;
  if (typeof shortLink === "string" && /^https:\/\/s\.shopee\.vn\//.test(shortLink)) {
    return reply({ ok: true, shortLink });
  }
  const detail = data && data.errors && data.errors[0] && data.errors[0].message;
  return reply({ ok: false, error: "shopee", detail: String(detail || "unknown").slice(0, 200) }, 502);
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return reply(null, 204);
    if (request.method !== "GET") return reply({ ok: false, error: "method" }, 405);

    const params = new URL(request.url).searchParams;
    if (params.has("shorten")) return shorten(params.get("shorten"), params.get("sub"), env);

    let current;
    try {
      current = new URL(new URL(request.url).searchParams.get("url") || "");
    } catch {
      return reply({ ok: false, error: "bad_url" }, 400);
    }
    if (!allowed(current)) return reply({ ok: false, error: "domain" }, 400);

    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (PRODUCT_HINT.test(current.pathname) || current.searchParams.has("origin_link")) {
        return reply({ ok: true, url: current.href, links: [] });
      }
      if (hop === MAX_REDIRECTS) break;
      let res;
      try {
        res = await fetch(current.href, {
          redirect: "manual",
          headers: { "User-Agent": MOBILE_UA, "Accept-Language": "vi-VN,vi;q=0.9" },
          signal: AbortSignal.timeout(6000),
        });
      } catch {
        return reply({ ok: false, error: "fetch" }, 502);
      }
      const location = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && location) {
        let next;
        try {
          next = new URL(location, current);
        } catch {
          break;
        }
        if (!allowed(next)) return reply({ ok: false, error: "domain" }, 400);
        current = next;
        continue;
      }
      const html = res.status === 200 ? (await res.text()).slice(0, 500000) : "";
      return reply({ ok: true, url: current.href, links: linksInHtml(html) });
    }
    return reply({ ok: true, url: current.href, links: [] });
  },
};
