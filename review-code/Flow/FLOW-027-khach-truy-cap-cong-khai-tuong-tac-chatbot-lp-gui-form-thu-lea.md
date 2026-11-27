# [FLOW-027] Khách Truy cập Công khai, Tương tác Chatbot LP & Gửi Form Thu Lead

> **Tầng nghiệp vụ**: TẦNG 5: LANDING PAGE BUILDER, PHỄU & XUẤT BẢN  
> **Thứ tự thực thi**: 27 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-026 (Landing Page đã xuất bản) hoặc FLOW-025 (Phễu đã xuất bản).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Khách hàng vãng lai (Public Visitor)

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **UI Components**: `/p/[slug]`, `public-landing-page-client.tsx`, `landing-page-chatbot-widget.tsx`.
* **API Endpoints**: `GET /landing-pages/public/:slug`, `POST /landing-pages/public/:slug/events`, `POST /landing-pages/public/:slug/lead`, `GET /landing-pages/public/:slug/chatbot/config`, `POST /landing-pages/public/:slug/chatbot/message`, `POST /landing-pages/public/:slug/chatbot/lead`, `POST /funnel-builder/public/:id/lead|cta`.
* **Models**: `LandingPageEvent`, `Lead`, `CustomerOutboxEvent`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. Khách truy cập qua link quảng cáo/chia sẻ (chứa `utm_*`, `fbclid`, `gclid`, `ref`). `GET /landing-pages/public/:slug` trả nội dung trang siêu nhanh từ public cache.
2. Trình duyệt ghi nhận sự kiện xem/cuộn/click CTA (`POST :slug/events` -> `LandingPageEvent`) và bắn Pixel (`Meta Pixel`, `GTM`).
3. **Luồng Form**: Khách điền form -> `POST :slug/lead` (hoặc `/funnel-builder/public/:id/lead`) gửi thông tin + UTM + affiliate ref.
4. **Luồng Chatbot nhúng trên LP**: Widget chatbot (`landing-page-chatbot-widget.tsx` với avatar robot) tải cấu hình (`GET :slug/chatbot/config` có kiểm tra CORS), trả lời khách dựa theo ngữ cảnh trang & RAG (`POST :slug/chatbot/message`), thu thông tin và gọi `POST :slug/chatbot/lead` + thông báo realtime (`landing-page-chatbot-notification.service.ts`).

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: Dữ liệu Form / Tin nhắn chat trên LP + tham số UTM / Ref.
* **Đầu ra (Output)**: Sự kiện đo lường `LandingPageEvent` và yêu cầu tạo Lead đẩy sang CRM.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Public CORS policy cho domain/subdomain hợp lệ, rate limit chống spam form/chat, chống XSS dữ liệu nhập.

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: FLOW-028 (Tiếp nhận Lead CRM), FLOW-043 (Attribution)

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-026](./FLOW-026-xuat-ban-landing-page-subdomain-nen-tang-ten-mien-rieng-ssl-pu.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-028](./FLOW-028-tiep-nhan-lead-khu-trung-lap-hop-nhat-dinh-danh-khach-hang-360.md)
