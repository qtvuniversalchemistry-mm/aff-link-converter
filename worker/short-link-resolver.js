// =====================================================================
//  BỘ MỞ LINK RÚT GỌN – chạy trên Cloudflare Workers (gói miễn phí)
//  Việc duy nhất: nhận link rút gọn Shopee/TikTok, đi theo chuyển hướng,
//  trả lại link đầy đủ. Không chứa mã affiliate, không lưu link.
//  Cách cài: xem README.md, mục "Bật đọc link rút gọn".
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

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") return reply(null, 204);
    if (request.method !== "GET") return reply({ ok: false, error: "method" }, 405);

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
