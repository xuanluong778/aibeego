# [FLOW-025] Khách Truy Cập Landing Page & Điền Form Đăng Ký (Lead Capture)

> **Tầng nghiệp vụ**: TẦNG 5: THIẾT KẾ & XUẤT BẢN LANDING PAGE / PHỄU (LANDING PAGES & FUNNEL CONVERSION)  
> **Thứ tự thực thi**: 25 / 58  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.

---

## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ

* **Điều kiện tiên quyết**: Landing Page đã xuất bản công khai (FLOW-024).
* **Tác nhân**: Khách hàng tiềm năng truy cập qua Quảng cáo / Mạng xã hội / Google Search.
* **Chi tiết luồng**:
  1. Khách hàng nhấp vào link quảng cáo có chứa tham số UTM (`utm_source`, `utm_medium`, `utm_campaign`, `fbclid`, `gclid`).
  2. Landing Page ghi nhận sự kiện mở trang (`LandingPageEvent` loại `VIEW`), lưu trữ dấu vân tay và tham số UTM vào cookie trình duyệt.
  3. Khách lướt xem nội dung, xem sản phẩm/dịch vụ, bấm vào form đăng ký.
  4. Khách điền thông tin: Họ tên, Số điện thoại, Email, Chi nhánh mong muốn, Lời nhắn.
  5. Khách bấm nút gửi (CTA Button):
     - Trình duyệt kích hoạt Pixel Event `Lead`.
     - Frontend gửi request `POST /api/v1/landing-pages/public/submit-lead` kèm toàn bộ dữ liệu form và UTM tracking context.
     - Màn hình chuyển sang Trang cảm ơn hoặc hiển thị Popup thông báo thành công.
* **Đầu vào**: Dữ liệu người dùng điền trên form + UTM context.
* **Đầu ra**: Tạo sự kiện chuyển đổi thành công.
* **Mở khóa**: FLOW-026 (Đẩy vào CRM xử lý).

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)

[⬅️ **Luồng trước**: FLOW-024 - Xuất Bản Landing Page & Tối Ưu CDN Caching (Publishing)](./FLOW-024-xuat-ban-landing-page-toi-uu-cdn-caching.md) | [📋 **Mục lục 58 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-026 - Tiếp Nhận Lead, Khử Trùng Lặp & Hợp Nhất Khách Hàng (Lead Ingestion & Deduplication)](./FLOW-026-tiep-nhan-lead-khu-trung-lap-hop-nhat-khach-hang.md)
