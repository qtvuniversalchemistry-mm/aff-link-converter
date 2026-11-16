// Đổi link ngay trên trình duyệt (dùng cho GitHub Pages – không có máy chủ).
// - Link đầy đủ (shopee.vn/...-i.SHOP.ITEM, tiktok.com/.../product/ID, an_redir): xử lý tại chỗ.
// - Link rút gọn (s.shopee.vn, vt.tiktok.com...): trình duyệt không tự mở được (bị chặn CORS),
//   nên gọi "bộ mở link rút gọn" (worker/short-link-resolver.js) nếu đã cài resolverUrl trong config.js.
import { convertLink, extractFirstUrl } from "./convert.js";

const noNetwork = () => Promise.reject(new Error("no network in browser"));

export const SHORT_LINK_HELP =
  "Link rút gọn chưa đọc được. Hãy mở link này trên trình duyệt, đợi trang sản phẩm hiện ra, " +
  "sao chép địa chỉ đầy đủ trên thanh địa chỉ rồi dán lại.";

export async function convertInBrowser(input, config, fetchImpl = globalThis.fetch) {
  const result = await convertWithResolver(input, config, fetchImpl);
  return shortenIfPossible(result, config, fetchImpl);
}

// Đổi link dài an_redir thành link rút gọn s.shopee.vn/... (qua Worker + Shopee Open API).
// Lỗi hoặc chưa cài khóa API thì giữ nguyên link dài, khách vẫn dùng được.
async function shortenIfPossible(result, config, fetchImpl) {
  const resolverUrl = (config.resolverUrl || "").trim();
  if (!result.ok || result.platform !== "shopee" || result.source !== "auto" || !resolverUrl) return result;
  try {
    const sep = resolverUrl.includes("?") ? "&" : "?";
    const url =
      resolverUrl + sep + "shorten=" + encodeURIComponent(result.productUrl) +
      "&sub=" + encodeURIComponent((config.shopee && config.shopee.subId) || "");
    const res = await fetchImpl(url);
    const data = await res.json();
    if (data && data.ok && typeof data.shortLink === "string" && /^https:\/\/s\.shopee\.vn\//.test(data.shortLink)) {
      return { ...result, longLink: result.affiliateLink, affiliateLink: data.shortLink, short: true };
    }
  } catch {
    /* giữ link dài */
  }
  return result;
}

async function convertWithResolver(input, config, fetchImpl) {
  const first = await convertLink(input, config, noNetwork);
  if (first.ok || first.code !== "NOT_PRODUCT") return first;

  const resolverUrl = (config.resolverUrl || "").trim();
  if (!resolverUrl) return { ...first, message: SHORT_LINK_HELP };

  let data;
  try {
    const raw = extractFirstUrl(input);
    const sep = resolverUrl.includes("?") ? "&" : "?";
    const res = await fetchImpl(resolverUrl + sep + "url=" + encodeURIComponent(raw));
    data = await res.json();
  } catch {
    return { ...first, message: "Không mở được link rút gọn (mất mạng hoặc máy chủ bận). " + SHORT_LINK_HELP };
  }

  const candidates = [data && data.url, ...((data && data.links) || [])].filter(
    (u) => typeof u === "string" && u
  );
  for (const candidate of candidates.slice(0, 20)) {
    const r = await convertLink(candidate, config, noNetwork);
    if (r.ok || r.code !== "NOT_PRODUCT") return r;
  }
  return first;
}
