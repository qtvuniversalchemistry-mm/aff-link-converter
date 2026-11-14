# Tool đổi link Shopee / TikTok thành link affiliate

Khách dán link sản phẩm Shopee hoặc TikTok Shop → tool trả lại link của **đúng sản phẩm đó** nhưng có gắn mã affiliate của bạn.

| Nền tảng | Cách hoạt động |
|---|---|
| **Shopee VN** | **Tự động** cho mọi sản phẩm. Tool lấy mã sản phẩm rồi tạo link dạng `https://s.shopee.vn/an_redir?origin_link=...&affiliate_id=ID_CỦA_BẠN&sub_id=...` |
| **TikTok Shop** | **Theo danh sách.** TikTok không cho tự ghép mã affiliate vào link, nên bạn tạo link affiliate trong TikTok rồi dán vào `config.js`. Sản phẩm chưa có trong danh sách → khách thấy nút "Nhắn mình để lấy link". |

Tool nhận được: link dài, link rút gọn (`s.shopee.vn`, `shp.ee`, `vt.tiktok.com`...), cả đoạn chữ chia sẻ từ app (tự tìm link trong đó), và link affiliate của người khác (tự thay bằng mã của bạn).

---

## Cài đặt (khoảng 15 phút, không cần biết code)

### Bước 1 — Lấy Shopee Affiliate ID

1. Đăng nhập trang Shopee Affiliate (affiliate.shopee.vn).
2. Tạo link affiliate cho một sản phẩm bất kỳ (nút **Lấy link**), được link dạng `https://s.shopee.vn/xxxx`.
3. Mở link đó bằng trình duyệt **trên máy tính**. Khi trang Shopee mở ra, nhìn thanh địa chỉ, tìm đoạn `utm_source=an_17xxxxxxxxx`.
4. Dãy số **sau `an_`** chính là Affiliate ID (ví dụ `17123456789`).

> Nếu giao diện Shopee khác mô tả, gửi ảnh chụp để được hướng dẫn lại.

### Bước 2 — Điền cấu hình

1. Trên GitHub, mở file **`config.js`** → bấm biểu tượng **cây bút** (Edit).
2. Điền Affiliate ID vào giữa hai dấu nháy: `affiliateId: "17123456789",`
3. (Tùy chọn) Điền link Zalo/fanpage vào `contactUrl`.
4. Bấm **Commit changes**.

### Bước 3 — Đưa web lên mạng bằng GitHub Pages (miễn phí)

1. Trên GitHub, mở repo **aff-link-converter** → **Settings** → mục **Pages** (cột trái).
2. Phần **Build and deployment**: **Source** chọn **Deploy from a branch**; **Branch** chọn **`main`** và thư mục **`/ (root)`** → **Save**.
3. Chờ 1–2 phút, tải lại trang Settings → Pages: thấy dòng *Your site is live at* `https://qtvuniversalchemistry-mm.github.io/aff-link-converter/` — đó là web tool.

Từ giờ mỗi lần sửa `config.js` trên nhánh `main`, web tự cập nhật sau 1–2 phút.

### Bước 3b — Bật đọc link rút gọn (nên làm, miễn phí)

GitHub Pages chỉ chứa trang tĩnh nên **không tự mở được link rút gọn** (`s.shopee.vn`, `vt.tiktok.com`) — đây lại là loại link app Shopee/TikTok tạo ra khi bấm *Sao chép liên kết*. Chưa làm bước này thì web vẫn đổi được link đầy đủ, còn link rút gọn sẽ hiện hướng dẫn để khách tự mở link lấy địa chỉ đầy đủ.

1. Vào **dash.cloudflare.com**, đăng ký/đăng nhập (miễn phí).
2. Chọn **Workers & Pages** → **Create** → tạo Worker từ mẫu **Hello World** → đặt tên, ví dụ `mainn-link` → **Deploy**.
3. Bấm **Edit code**, xóa hết code mẫu, dán toàn bộ nội dung file **`worker/short-link-resolver.js`** → **Deploy**.
4. Sao chép địa chỉ Worker (dạng `https://mainn-link.ten-ban.workers.dev`) và dán vào `resolverUrl` trong `config.js` → Commit.
5. Kiểm tra: dán 1 link `s.shopee.vn/...` vào web tool → phải ra link ưu đãi của đúng sản phẩm.

> Giao diện Cloudflare có thể khác mô tả; gửi ảnh chụp nếu không thấy đúng nút. Worker này chỉ mở link Shopee/TikTok, không chứa mã affiliate, không lưu link.

### Bước 4 — KIỂM TRA BẮT BUỘC trước khi chia sẻ cho khách

1. Mở web tool, dán link 1 sản phẩm Shopee, bấm **Lấy link ưu đãi** → **Mở ngay**.
   - Đúng: mở ra đúng sản phẩm vừa dán.
2. Sau vài giờ, vào Shopee Affiliate → báo cáo **Click**, lọc theo Sub ID `webtool`.
   - Đúng: thấy lượt click vừa tạo.
3. Nếu **không** thấy click được ghi nhận: tạm thời dùng cách thủ công giống TikTok (mục dưới) cho Shopee, và báo lại để kiểm tra.

---

## Thêm sản phẩm TikTok Shop

1. Trong TikTok Shop Affiliate (app TikTok hoặc trang creator), tạo link affiliate cho sản phẩm → được link dạng `https://vt.tiktok.com/ZS.../`.
2. Lấy mã sản phẩm: mở link sản phẩm gốc, dãy số dài sau `/product/` (ví dụ `1729384756473829`).
3. Sửa `config.js`, thêm 1 dòng vào phần `products`:

```js
  products: {
    "1729384756473829": "https://vt.tiktok.com/ZSabc123/",
    "1729000000000000": "https://vt.tiktok.com/ZSxyz789/",
  },
```

Mỗi sản phẩm một dòng, nhớ dấu phẩy cuối dòng. Commit → chờ 1 phút → thử lại.

Cũng có thể dùng `products` cho Shopee nếu muốn chỉ định link riêng: mã là `"SHOPID.ITEMID"` (hai dãy số sau `-i.` trong link Shopee).

---

## Giới hạn cần biết

- **Định dạng link Shopee `an_redir`**: đã được Shopee mô tả trong tài liệu trợ giúp (bản Thái Lan) và nhiều tool tại VN đang dùng, nhưng chưa thấy tài liệu chính thức của Shopee VN. Vì vậy **phải làm Bước 4** để xác nhận hoa hồng được ghi nhận.
- **TikTok Shop** không tạo link tự động được. Muốn tự động cần API Affiliate của TikTok (phải đăng ký đối tác và được duyệt).
- **Mã affiliate nằm công khai** trong `config.js` (repo public, web tĩnh). Đây là bình thường với link affiliate vì mã vốn hiện trong link, nhưng không đưa thông tin bí mật nào khác vào `config.js`.
- Tool **không lưu** link khách dán. Lịch sử "Link gần đây" chỉ nằm trên máy của khách.
- Shopee/TikTok có thể đổi cấu trúc link bất cứ lúc nào; khi tool báo "Không đọc được sản phẩm" nhiều bất thường, cần kiểm tra lại.

---

## Cấu trúc thư mục (cho người kỹ thuật)

```
index.html        Giao diện (một file, không cần build) – đổi link ngay trên trình duyệt
lib/convert.js    Logic nhận diện link, mở link rút gọn, tạo link affiliate
lib/web.js        Chạy lib/convert.js trên trình duyệt (GitHub Pages), gọi Worker khi gặp link rút gọn
worker/           Cloudflare Worker mở link rút gọn (tùy chọn)
api/convert.js    Bản API cho Vercel (không dùng khi chạy trên GitHub Pages)
config.js         Cấu hình: affiliate ID, danh sách link thủ công, liên hệ
tests/            Test tự động: npm test
```

Bảo mật: khi mở link rút gọn, Worker chỉ đi theo chuyển hướng tới domain Shopee VN / TikTok, tối đa 6 bước, timeout 6 giây.
