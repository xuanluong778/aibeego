# [FLOW-023] Gắn Tên Miền Riêng & Cài Đặt Tracking Pixels

> **Tầng nghiệp vụ**: TẦNG 5: THIẾT KẾ & XUẤT BẢN LANDING PAGE / PHỄU (LANDING PAGES & FUNNEL CONVERSION)  
> **Thứ tự thực thi**: 23 / 58  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.

---

## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ

* **Điều kiện tiên quyết**: Có Landing Page (FLOW-021) hoặc Phễu (FLOW-022).
* **Tác nhân**: Kỹ thuật viên / Marketer.
* **Chi tiết luồng**:
  1. Vào Cài đặt Landing Page -> Tên miền:
     - Thêm Tên miền riêng (`LandingPageDomainConnection`): ví dụ `khuyenmai.mybrand.com`.
     - Hệ thống hướng dẫn trỏ bản ghi CNAME về máy chủ AiBeego.
     - Bấm "Kiểm tra DNS" -> Hệ thống tự động cấp phát chứng chỉ bảo mật SSL (Let's Encrypt HTTPS miễn phí).
  2. Cài đặt mã tiếp thị & đo lường (Marketing Tracking Pixels):
     - Gắn Meta Pixel ID (Facebook Pixel) & Meta Conversion API Token.
     - Gắn Google Tag Manager (GTM) / Google Analytics 4 (GA4).
     - Gắn TikTok Pixel ID.
     - Cấu hình bắt sự kiện chuẩn: `PageView`, `ViewContent`, `Lead`, `AddToCart`, `Purchase`.
* **Đầu ra**: Landing Page gắn tên miền thương hiệu riêng và kích hoạt hệ thống đo lường hành vi người dùng.
* **Mở khóa**: FLOW-024.

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)

[⬅️ **Luồng trước**: FLOW-022 - Thiết lập Phễu Chuyển Đổi Đa Bước (Multi-Step Funnel Pipeline)](./FLOW-022-thiet-lap-pheu-chuyen-doi-da-buoc.md) | [📋 **Mục lục 58 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-024 - Xuất Bản Landing Page & Tối Ưu CDN Caching (Publishing)](./FLOW-024-xuat-ban-landing-page-toi-uu-cdn-caching.md)
