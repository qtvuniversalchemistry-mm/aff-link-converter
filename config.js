// =====================================================================
//  CẤU HÌNH CỦA BẠN — CHỈ CẦN SỬA FILE NÀY
//  Sửa xong bấm "Commit changes" trên GitHub, GitHub Pages tự cập nhật sau 1–2 phút.
//  Lưu ý: giữ nguyên dấu nháy "..." và dấu phẩy cuối dòng.
// =====================================================================

export default {
  // ----- SHOPEE -----
  shopee: {
    // Affiliate ID của bạn (dãy số, thường bắt đầu bằng 17...).
    // Cách lấy: xem README.md, mục "Lấy Shopee Affiliate ID".
    affiliateId: "17322860354",

    // Sub ID (tùy chọn) để lọc trong báo cáo Shopee Affiliate, ví dụ "webtool".
    // Chỉ dùng chữ không dấu, số, dấu gạch dưới. Để trống nếu không cần.
    subId: "webtool",
  },

  // ----- LINK AFFILIATE CÓ SẴN (dùng cho TikTok Shop, hoặc ghi đè Shopee) -----
  // TikTok Shop không cho tự ghép mã affiliate vào link,
  // nên bạn tạo link affiliate trong TikTok Shop Affiliate rồi dán vào đây.
  //
  // Cú pháp:  "MÃ_SẢN_PHẨM": "LINK_AFFILIATE",
  // - TikTok: mã sản phẩm là dãy số dài trong link, ví dụ
  //     https://shop.tiktok.com/view/product/1729384756473829 -> "1729384756473829"
  // - Shopee: mã là "shopid.itemid", ví dụ
  //     https://shopee.vn/ao-thun-i.12345678.987654321 -> "12345678.987654321"
  //   (chỉ cần khi bạn muốn dùng link khác thay cho link tự tạo)
  products: {
    // "1729384756473829": "https://vt.tiktok.com/ZSxxxxxxx/",
  },

  // ----- LIÊN HỆ (hiện khi sản phẩm chưa có link affiliate) -----
  // Ví dụ: "https://zalo.me/0912345678" hoặc link fanpage. Để trống để ẩn nút.
  contactUrl: "",
  contactLabel: "Nhắn mình để lấy link",

  // ----- BỘ MỞ LINK RÚT GỌN (s.shopee.vn, vt.tiktok.com...) -----
  // GitHub Pages không tự mở được link rút gọn. Dán địa chỉ Cloudflare Worker vào đây
  // (cách tạo: README.md, mục "Bật đọc link rút gọn"), ví dụ "https://mainn-link.ten-ban.workers.dev".
  // Để trống: web vẫn đổi được link đầy đủ, link rút gọn sẽ hiện hướng dẫn cho khách.
  resolverUrl: "",
};
