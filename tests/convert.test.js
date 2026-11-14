import { test } from "node:test";
import assert from "node:assert/strict";
import { convertLink, extractFirstUrl } from "../lib/convert.js";
import handler from "../api/convert.js";

const cfg = {
  shopee: { affiliateId: "17123456789", subId: "webtool" },
  products: {
    "1729384756473829": "https://vt.tiktok.com/ZSmyAff123/",
    "111.222": "https://s.shopee.vn/manualLink",
  },
  contactUrl: "https://zalo.me/000",
  contactLabel: "Nhắn mình",
};

// fetch giả lập: map URL -> {status, location?, body?}
function fakeFetch(routes) {
  const calls = [];
  const fn = async (href) => {
    calls.push(href);
    const r = routes[href];
    if (!r) throw new Error("unexpected fetch " + href);
    return {
      status: r.status,
      headers: { get: (h) => (h.toLowerCase() === "location" ? r.location ?? null : null) },
      text: async () => r.body ?? "",
    };
  };
  fn.calls = calls;
  return fn;
}
const noFetch = fakeFetch({});

const expectedShopee = (shop, item) =>
  "https://s.shopee.vn/an_redir?origin_link=" +
  encodeURIComponent(`https://shopee.vn/product/${shop}/${item}`) +
  "&affiliate_id=17123456789&sub_id=webtool";

test("Shopee: link dài dạng -i.SHOP.ITEM, không gọi mạng", async () => {
  const r = await convertLink("https://shopee.vn/Ao-Thun-Nam-Cotton-i.12345678.987654321?sp_atk=abc&xptdk=x", cfg, noFetch);
  assert.equal(r.ok, true);
  assert.equal(r.platform, "shopee");
  assert.equal(r.productId, "12345678.987654321");
  assert.equal(r.affiliateLink, expectedShopee("12345678", "987654321"));
  assert.equal(r.source, "auto");
  assert.equal(noFetch.calls.length, 0);
});

test("Shopee: dạng /product/SHOP/ITEM và /tenshop/SHOP/ITEM", async () => {
  const a = await convertLink("https://shopee.vn/product/55/66", cfg, noFetch);
  assert.equal(a.affiliateLink, expectedShopee("55", "66"));
  const b = await convertLink("https://shopee.vn/mainnshop/77/88?x=1", cfg, noFetch);
  assert.equal(b.affiliateLink, expectedShopee("77", "88"));
});

test("Shopee: tên có dấu tiếng Việt (URL-encoded)", async () => {
  const r = await convertLink("https://shopee.vn/%C3%81o-thun-i.1.2", cfg, noFetch);
  assert.equal(r.productId, "1.2");
});

test("Shopee: link rút gọn s.shopee.vn + văn bản chia sẻ từ app", async () => {
  const f = fakeFetch({
    "https://s.shopee.vn/4fqNGGZ5Xk": {
      status: 302,
      location: "https://shopee.vn/universal-link/product/333/444?utm_source=an_999&utm_medium=affiliates",
    },
  });
  const text = "Xem Áo thun giá ₫99.000 tại Shopee! https://s.shopee.vn/4fqNGGZ5Xk";
  const r = await convertLink(text, cfg, f);
  assert.equal(r.ok, true);
  assert.equal(r.affiliateLink, expectedShopee("333", "444"));
  assert.equal(f.calls.length, 1);
});

test("Shopee: link rút gọn chuyển hướng nhiều bước và dạng shp.ee", async () => {
  const f = fakeFetch({
    "https://vn.shp.ee/abc": { status: 301, location: "https://s.shopee.vn/xyz" },
    "https://s.shopee.vn/xyz": { status: 302, location: "/Ten-sp-i.10.20" },
  });
  const r = await convertLink("vn.shp.ee/abc", cfg, f);
  assert.equal(r.affiliateLink, expectedShopee("10", "20"));
});

test("Shopee: link affiliate của người khác (an_redir) -> đổi sang mã của mình", async () => {
  const other =
    "https://s.shopee.vn/an_redir?origin_link=" +
    encodeURIComponent("https://shopee.vn/abc-i.5.6") +
    "&affiliate_id=999&sub_id=x";
  const r = await convertLink(other, cfg, noFetch);
  assert.equal(r.affiliateLink, expectedShopee("5", "6"));
  assert.ok(!r.affiliateLink.includes("affiliate_id=999"));
});

test("Shopee: trang chuyển hướng bằng JavaScript (200 + HTML)", async () => {
  const f = fakeFetch({
    "https://s.shopee.vn/js": {
      status: 200,
      body: '<script>window.location.href="https:\\/\\/shopee.vn\\/product\\/1\\/9?x=1"</script>',
    },
  });
  const r = await convertLink("https://s.shopee.vn/js", cfg, f);
  assert.equal(r.affiliateLink, expectedShopee("1", "9"));
});

test("Shopee: ghi đè thủ công trong config.products", async () => {
  const r = await convertLink("https://shopee.vn/x-i.111.222", cfg, noFetch);
  assert.equal(r.affiliateLink, "https://s.shopee.vn/manualLink");
  assert.equal(r.source, "manual");
});

test("Shopee: chưa cài affiliateId -> báo lỗi rõ", async () => {
  const r = await convertLink("https://shopee.vn/x-i.1.2", { ...cfg, shopee: { affiliateId: "" } }, noFetch);
  assert.equal(r.ok, false);
  assert.equal(r.code, "NOT_CONFIGURED");
});

test("Shopee nước ngoài bị từ chối", async () => {
  const r = await convertLink("https://shopee.co.th/x-i.1.2", cfg, noFetch);
  assert.equal(r.code, "UNSUPPORTED");
});

test("TikTok: sản phẩm có trong danh sách", async () => {
  const r = await convertLink("https://shop.tiktok.com/view/product/1729384756473829?region=VN&locale=vi-VN", cfg, noFetch);
  assert.equal(r.ok, true);
  assert.equal(r.platform, "tiktok");
  assert.equal(r.affiliateLink, "https://vt.tiktok.com/ZSmyAff123/");
});

test("TikTok: link rút gọn vt.tiktok.com", async () => {
  const f = fakeFetch({
    "https://vt.tiktok.com/ZSabc/": {
      status: 301,
      location: "https://www.tiktok.com/shop/pdp/ao-thun/1729384756473829?source=share",
    },
  });
  const r = await convertLink("https://vt.tiktok.com/ZSabc/", cfg, f);
  assert.equal(r.ok, true);
  assert.equal(r.productId, "1729384756473829");
});

test("TikTok: chưa có trong danh sách -> trả nút liên hệ", async () => {
  const r = await convertLink("https://www.tiktok.com/view/product/1700000000000000001", cfg, noFetch);
  assert.equal(r.ok, false);
  assert.equal(r.code, "TIKTOK_NOT_LISTED");
  assert.equal(r.productId, "1700000000000000001");
  assert.equal(r.contactUrl, "https://zalo.me/000");
});

test("Bảo mật: không đi theo chuyển hướng ra domain lạ", async () => {
  const f = fakeFetch({
    "https://s.shopee.vn/evil": { status: 302, location: "http://169.254.169.254/latest/meta-data" },
  });
  const r = await convertLink("https://s.shopee.vn/evil", cfg, f);
  assert.equal(r.ok, false);
  assert.equal(r.code, "NOT_PRODUCT");
  assert.equal(f.calls.length, 1);
});

test("Domain giả mạo (shopee.vn.evil.com) bị từ chối", async () => {
  const r = await convertLink("https://shopee.vn.evil.com/x-i.1.2", cfg, noFetch);
  assert.equal(r.code, "UNSUPPORTED");
});

test("Không có link / link khác nền tảng", async () => {
  assert.equal((await convertLink("xin chào", cfg, noFetch)).code, "NO_URL");
  assert.equal((await convertLink("https://lazada.vn/abc", cfg, noFetch)).code, "UNSUPPORTED");
});

test("Lỗi mạng khi mở link rút gọn -> báo lỗi thân thiện", async () => {
  const r = await convertLink("https://s.shopee.vn/down", cfg, async () => {
    throw new Error("timeout");
  });
  assert.equal(r.code, "NOT_PRODUCT");
});

test("extractFirstUrl bỏ dấu câu cuối", () => {
  assert.equal(extractFirstUrl("mua cái này nhé https://shopee.vn/a-i.1.2."), "https://shopee.vn/a-i.1.2");
});

test("API handler: POST JSON, thiếu url, sai method", async () => {
  const mkRes = () => {
    const res = { statusCode: 0, body: null, headers: {} };
    res.setHeader = (k, v) => (res.headers[k] = v);
    res.status = (c) => ((res.statusCode = c), res);
    res.json = (b) => ((res.body = b), res);
    return res;
  };
  let res = mkRes();
  await handler({ method: "POST", body: { url: "https://shopee.vn/x-i.1.2" } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(typeof res.body.ok, "boolean");
  res = mkRes();
  await handler({ method: "POST", body: {} }, res);
  assert.equal(res.statusCode, 400);
  res = mkRes();
  await handler({ method: "DELETE" }, res);
  assert.equal(res.statusCode, 405);
});
