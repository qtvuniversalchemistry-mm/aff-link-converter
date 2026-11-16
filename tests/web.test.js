import { test } from "node:test";
import assert from "node:assert/strict";
import { convertInBrowser, SHORT_LINK_HELP } from "../lib/web.js";
import worker from "../worker/short-link-resolver.js";

const cfg = {
  shopee: { affiliateId: "17123456789", subId: "webtool" },
  products: { "1729384756473829": "https://vt.tiktok.com/ZSmyAff123/" },
  contactUrl: "",
  contactLabel: "Liên hệ",
};
const json = (o) => ({ json: async () => o });
const mustNotFetch = async () => { throw new Error("không được gọi mạng"); };

test("Trình duyệt: link Shopee đầy đủ đổi ngay, không gọi mạng", async () => {
  const r = await convertInBrowser("https://shopee.vn/Ao-i.12345678.987654321", cfg, mustNotFetch);
  assert.equal(r.ok, true);
  assert.match(r.affiliateLink, /affiliate_id=17123456789/);
});

test("Trình duyệt: link rút gọn khi chưa cài resolverUrl -> hướng dẫn khách", async () => {
  const r = await convertInBrowser("https://s.shopee.vn/abc", cfg, mustNotFetch);
  assert.equal(r.ok, false);
  assert.equal(r.message, SHORT_LINK_HELP);
});

test("Trình duyệt: link rút gọn qua bộ mở link (url hoặc links trong trang)", async () => {
  const c = { ...cfg, resolverUrl: "https://r.example.workers.dev" };
  let called;
  const f = async (u) => { called = u; return json({ ok: true, url: "https://shopee.vn/product/1/2", links: [] }); };
  const r = await convertInBrowser("Xem nè https://s.shopee.vn/abc", c, f);
  assert.equal(called, "https://r.example.workers.dev?url=" + encodeURIComponent("https://s.shopee.vn/abc"));
  assert.equal(r.ok, true);
  assert.equal(r.productId, "1.2");

  const f2 = async () => json({ ok: true, url: "https://vt.tiktok.com/x", links: ["https://www.tiktok.com/view/product/1729384756473829"] });
  const r2 = await convertInBrowser("https://vt.tiktok.com/x", c, f2);
  assert.equal(r2.ok, true);
  assert.equal(r2.affiliateLink, "https://vt.tiktok.com/ZSmyAff123/");
});

test("Trình duyệt: bộ mở link lỗi mạng -> báo lỗi thân thiện", async () => {
  const c = { ...cfg, resolverUrl: "https://r.example.workers.dev" };
  const r = await convertInBrowser("https://s.shopee.vn/abc", c, async () => { throw new Error("x"); });
  assert.equal(r.ok, false);
  assert.match(r.message, /Không mở được link rút gọn/);
});

// ---- Cloudflare Worker ----
async function callWorker(target, routes) {
  const orig = globalThis.fetch;
  globalThis.fetch = async (href) => {
    const r = routes[href];
    if (!r) throw new Error("unexpected " + href);
    return new Response(r.body ?? "", { status: r.status, headers: r.location ? { location: r.location } : {} });
  };
  try {
    const res = await worker.fetch(new Request("https://w.dev/?url=" + encodeURIComponent(target)));
    return { status: res.status, cors: res.headers.get("access-control-allow-origin"), body: await res.json() };
  } finally {
    globalThis.fetch = orig;
  }
}

test("Worker: đi theo chuyển hướng tới trang sản phẩm, có CORS", async () => {
  const r = await callWorker("https://s.shopee.vn/abc", {
    "https://s.shopee.vn/abc": { status: 302, location: "https://shopee.vn/Ao-i.1.2?x=1" },
  });
  assert.equal(r.status, 200);
  assert.equal(r.cors, "*");
  assert.equal(r.body.url, "https://shopee.vn/Ao-i.1.2?x=1");
});

test("Worker: trang chuyển hướng bằng JavaScript -> trả link trong HTML", async () => {
  const r = await callWorker("https://vt.tiktok.com/ZS1/", {
    "https://vt.tiktok.com/ZS1/": { status: 200, body: 'go("https:\\/\\/www.tiktok.com\\/view\\/product\\/1729384756473829?a=1")' },
  });
  assert.deepEqual(r.body.links, ["https://www.tiktok.com/view/product/1729384756473829?a=1"]);
});

test("Worker: từ chối domain lạ và chuyển hướng ra domain lạ", async () => {
  assert.equal((await callWorker("https://evil.com/x", {})).status, 400);
  assert.equal((await callWorker("https://shopee.vn.evil.com/x", {})).status, 400);
  const r = await callWorker("https://s.shopee.vn/abc", {
    "https://s.shopee.vn/abc": { status: 302, location: "https://evil.com/" },
  });
  assert.equal(r.status, 400);
});

test("Tắt TikTok (enableTiktok: false): link TikTok bị từ chối, Shopee vẫn chạy", async () => {
  const c = { ...cfg, enableTiktok: false };
  const t = await convertInBrowser("https://shop.tiktok.com/view/product/1729384756473829", c, mustNotFetch);
  assert.equal(t.ok, false);
  assert.equal(t.message, "Hiện chỉ hỗ trợ link sản phẩm Shopee.");
  const t2 = await convertInBrowser("https://vt.tiktok.com/ZS1/", { ...c, resolverUrl: "https://r.dev" }, mustNotFetch);
  assert.equal(t2.message, "Hiện chỉ hỗ trợ link sản phẩm Shopee.");
  const s = await convertInBrowser("https://shopee.vn/Ao-i.1.2", c, mustNotFetch);
  assert.equal(s.ok, true);
});
