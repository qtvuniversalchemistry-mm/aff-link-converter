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

### Bước 3 — Đưa web lên mạng bằng Vercel (miễn phí)

1. Vào **vercel.com** → **Sign Up** → chọn **Continue with GitHub**.
2. Bấm **Add New… → Project** → chọn repo **aff-link-converter** → **Import**.
3. Không cần đổi gì, bấm **Deploy**. Chờ ~1 phút.
4. Vercel cho bạn một địa chỉ dạng `https://aff-link-converter-xxx.vercel.app` — đó là web tool.
5. Muốn dùng tên miền riêng: trong Vercel vào **Settings → Domains**.

Từ giờ mỗi lần sửa `config.js` trên GitHub, Vercel tự cập nhật web sau khoảng 1 phút.

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
- **Vercel gói Hobby (miễn phí)** theo điều khoản là cho mục đích cá nhân, phi thương mại. Nếu dùng lâu dài cho kinh doanh, nên xem lại điều khoản Vercel hoặc nâng gói.
- Tool **không lưu** link khách dán. Lịch sử "Link gần đây" chỉ nằm trên máy của khách.
- Shopee/TikTok có thể đổi cấu trúc link bất cứ lúc nào; khi tool báo "Không đọc được sản phẩm" nhiều bất thường, cần kiểm tra lại.

---

## Cấu trúc thư mục (cho người kỹ thuật)

```
index.html        Giao diện (một file, không cần build)
api/convert.js    API Vercel: POST /api/convert {url}
lib/convert.js    Logic nhận diện link, mở link rút gọn, tạo link affiliate
config.js         Cấu hình: affiliate ID, danh sách link thủ công, liên hệ
tests/            Test tự động: npm test
```

Bảo mật: khi mở link rút gọn, server chỉ đi theo chuyển hướng tới domain Shopee VN / TikTok, tối đa 6 bước, timeout 6 giây.
