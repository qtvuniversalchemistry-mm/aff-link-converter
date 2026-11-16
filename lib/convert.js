// Logic đổi link sản phẩm Shopee / TikTok Shop thành link affiliate.
// Không phụ thuộc Vercel để có thể test độc lập (fetch được truyền vào).

const MAX_INPUT_LENGTH = 2000;
const MAX_REDIRECTS = 6;
const FETCH_TIMEOUT_MS = 6000;
const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

// ---------- Nhận diện nền tảng (chỉ cho phép các domain này) ----------

function hostMatches(host, domain) {
  return host === domain || host.endsWith("." + domain);
}

export function detectPlatform(url) {
  const host = url.hostname.toLowerCase();
  if (hostMatches(host, "shopee.vn") || hostMatches(host, "shp.ee") || hostMatches(host, "shope.ee")) {
    return "shopee";
  }
  if (hostMatches(host, "tiktok.com")) return "tiktok";
  if (/(^|\.)shopee\.[a-z.]+$/.test(host)) return "shopee-foreign";
  return null;
}

// ---------- Lấy URL đầu tiên trong đoạn text người dùng dán ----------

export function extractFirstUrl(text) {
  if (typeof text !== "string") return null;
  const trimmed = text.trim().slice(0, MAX_INPUT_LENGTH);
  const match = trimmed.match(/https?:\/\/[^\s<>"'，。]+/i);
  if (match) return match[0].replace(/[),.;!?]+$/, "");
  // Trường hợp dán thiếu "https://", ví dụ "shopee.vn/abc-i.1.2"
  const bare = trimmed.match(/(?:^|\s)((?:[a-z0-9-]+\.)*(?:shopee\.vn|shp\.ee|shope\.ee|tiktok\.com)\/[^\s<>"']*)/i);
  if (bare) return "https://" + bare[1].replace(/[),.;!?]+$/, "");
  return null;
}

// ---------- Tách mã sản phẩm ----------

export function parseShopeeProduct(url) {
  const path = safeDecode(url.pathname);
  const patterns = [
    /(?:^|[-/.])i\.(\d+)\.(\d+)/, // /ten-san-pham-i.SHOPID.ITEMID
    /\/product\/(\d+)\/(\d+)/, // /product/SHOPID/ITEMID (và /universal-link/product/...)
    /^\/[^/]+\/(\d+)\/(\d+)\/?$/, // /tenshop/SHOPID/ITEMID
  ];
  for (const re of patterns) {
    const m = path.match(re);
    if (m) return { shopId: m[1], itemId: m[2] };
  }
  return null;
}

export function parseTiktokProduct(url) {
  const path = safeDecode(url.pathname);
  const m = path.match(/\/product\/(\d{10,})/) || path.match(/\/pdp\/(?:[^/]+\/)?(\d{10,})/);
  if (m) return { productId: m[1] };
  for (const key of ["product_id", "productId", "pid"]) {
    const v = url.searchParams.get(key);
    if (v && /^\d{10,}$/.test(v)) return { productId: v };
  }
  // Dự phòng: đoạn đường dẫn là dãy số dài (mã sản phẩm TikTok thường 15-20 số)
  const seg = path.split("/").reverse().find((s) => /^\d{15,20}$/.test(s));
  if (seg) return { productId: seg };
  return null;
}

// Link affiliate Shopee dạng an_redir: lấy link gốc trong tham số origin_link
function unwrapShopeeRedirect(url) {
  const origin = url.searchParams.get("origin_link");
  if (!origin) return null;
  try {
    return new URL(origin);
  } catch {
    return null;
  }
}

function safeDecode(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

// Tìm link sản phẩm nằm trong nội dung trang (khi link rút gọn chuyển hướng bằng JavaScript)
function findProductUrlInHtml(html, platform) {
  const text = html.replace(/\\\//g, "/").replace(/&amp;/g, "&");
  const re =
    platform === "shopee"
      ? /https?:\/\/(?:[a-z0-9-]+\.)*shopee\.vn\/[^\s"'<>\\]+/gi
      : /https?:\/\/(?:[a-z0-9-]+\.)*tiktok\.com\/[^\s"'<>\\]+/gi;
  for (const raw of text.match(re) || []) {
    try {
      const u = new URL(raw);
      const parsed = platform === "shopee" ? parseShopeeProduct(u) : parseTiktokProduct(u);
      if (parsed) return u;
    } catch {
      /* bỏ qua */
    }
  }
  return null;
}

// ---------- Mở link rút gọn (chỉ đi theo các domain được phép) ----------

export async function resolveUrl(startUrl, platform, fetchImpl) {
  let current = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const parsed = platform === "shopee" ? parseShopeeProduct(current) : parseTiktokProduct(current);
    if (parsed) return current;
    if (platform === "shopee") {
      const inner = unwrapShopeeRedirect(current);
      if (inner && detectPlatform(inner) === "shopee") {
        current = inner;
        continue;
      }
    }
    if (hop === MAX_REDIRECTS) break;

    let res;
    try {
      res = await fetchImpl(current.href, {
        method: "GET",
        redirect: "manual",
        headers: { "User-Agent": MOBILE_UA, "Accept-Language": "vi-VN,vi;q=0.9" },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch {
      return null;
    }

    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      let next;
      try {
        next = new URL(location, current);
      } catch {
        return null;
      }
      if (detectPlatform(next) !== platform) return null; // không đi ra domain lạ
      current = next;
      continue;
    }

    if (res.status === 200) {
      const html = (await res.text()).slice(0, 500_000);
      return findProductUrlInHtml(html, platform);
    }
    return null;
  }
  return null;
}

// ---------- Tạo link affiliate ----------

export function buildShopeeAffiliateLink({ shopId, itemId }, cfg) {
  const origin = `https://shopee.vn/product/${shopId}/${itemId}`;
  const params = new URLSearchParams({ origin_link: origin, affiliate_id: cfg.affiliateId });
  if (cfg.subId) params.set("sub_id", cfg.subId);
  return { origin, affiliateLink: `https://s.shopee.vn/an_redir?${params.toString()}` };
}

function fail(code, message, config) {
  return {
    ok: false,
    code,
    message,
    contactUrl: config.contactUrl || "",
    contactLabel: config.contactLabel || "Liên hệ",
  };
}

export async function convertLink(input, config, fetchImpl = globalThis.fetch) {
  const rawUrl = extractFirstUrl(input);
  if (!rawUrl) return fail("NO_URL", "Không tìm thấy link trong nội dung bạn dán.", config);

  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return fail("BAD_URL", "Link không hợp lệ.", config);
  }

  const platform = detectPlatform(url);
  if (platform === "shopee-foreign") {
    return fail("UNSUPPORTED", "Hiện chỉ hỗ trợ Shopee Việt Nam (shopee.vn).", config);
  }
  if (platform === "tiktok" && config.enableTiktok === false) {
    return fail("UNSUPPORTED", "Hiện chỉ hỗ trợ link sản phẩm Shopee.", config);
  }
  if (!platform) {
    const msg = config.enableTiktok === false
      ? "Hiện chỉ hỗ trợ link sản phẩm Shopee."
      : "Chỉ hỗ trợ link sản phẩm Shopee và TikTok Shop.";
    return fail("UNSUPPORTED", msg, config);
  }

  const resolved = await resolveUrl(url, platform, fetchImpl);
  if (!resolved) {
    return fail(
      "NOT_PRODUCT",
      "Không đọc được sản phẩm từ link này. Hãy mở sản phẩm, bấm Chia sẻ → Sao chép liên kết rồi dán lại.",
      config
    );
  }

  const manual = config.products || {};

  if (platform === "shopee") {
    const p = parseShopeeProduct(resolved);
    const key = `${p.shopId}.${p.itemId}`;
    const productUrl = `https://shopee.vn/product/${p.shopId}/${p.itemId}`;
    if (manual[key]) {
      return { ok: true, platform, productId: key, productUrl, affiliateLink: manual[key], source: "manual" };
    }
    if (!config.shopee?.affiliateId) {
      return fail("NOT_CONFIGURED", "Hệ thống chưa cài mã affiliate Shopee.", config);
    }
    const { affiliateLink } = buildShopeeAffiliateLink(p, config.shopee);
    return { ok: true, platform, productId: key, productUrl, affiliateLink, source: "auto" };
  }

  // TikTok Shop: chỉ trả link khi đã có trong danh sách
  const { productId } = parseTiktokProduct(resolved);
  const productUrl = `https://shop.tiktok.com/view/product/${productId}`;
  if (manual[productId]) {
    return { ok: true, platform, productId, productUrl, affiliateLink: manual[productId], source: "manual" };
  }
  return {
    ...fail("TIKTOK_NOT_LISTED", "Sản phẩm TikTok này chưa có link ưu đãi.", config),
    platform,
    productId,
  };
}
