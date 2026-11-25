# [FLOW-012] Kết nối Meta Fanpage & Facebook Ads (Meta Integration)

> **Tầng nghiệp vụ**: TẦNG 3: KẾT NỐI KÊNH BÊN NGOÀI & TÍCH HỢP (INTEGRATIONS & EXTERNAL CHANNELS)  
> **Thứ tự thực thi**: 12 / 58  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.

---

## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ

* **Điều kiện tiên quyết**: Có Tổ chức (FLOW-007).
* **Tác nhân**: Quản trị viên Marketing.
* **Chi tiết luồng**:
  1. Người dùng truy cập `/settings/integrations/facebook`, bấm "Kết nối Facebook".
  2. Hệ thống chuyển hướng sang Meta OAuth Dialog với đầy đủ scope: `pages_manage_posts`, `pages_messaging`, `ads_management`, `ads_read`, `leads_retrieval`.
  3. Meta trả về authorization code -> API đổi lấy User Access Token dài hạn.
  4. Lấy danh sách Trang Fanpage thuộc quyền quản lý, người dùng tích chọn các Trang muốn kết nối (`AutoPostFacebookPage`, `ChatbotFacebookPage`).
  5. Đăng ký Webhook `subscribed_apps` cho Fanpage để lắng nghe tin nhắn, bình luận và Lead Ads theo thời gian thực.
  6. Kết nối tài khoản quảng cáo (`FacebookAdsConnection`) để lấy dữ liệu chiến dịch, chi phí quảng cáo.
* **Đầu vào**: Quyền cấp phép từ tài khoản Meta.
* **Đầu ra**: `AutoPostFacebookPage`, `FacebookAdsConnection`, Webhook lắng nghe tin nhắn và lead.
* **Mở khóa**: FLOW-038 (Tự động đăng bài), FLOW-039 (AI Ads Manager), FLOW-044 (Chatbot Fanpage).

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)

[⬅️ **Luồng trước**: FLOW-011 - Nạp ví Credit & Trừ điểm dịch vụ AI (Credit Wallet & Usage Metering)](./FLOW-011-nap-vi-credit-tru-diem-dich-vu-ai.md) | [📋 **Mục lục 58 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-013 - Kết nối Zalo Official Account (Zalo OA & ZNS Integration)](./FLOW-013-ket-noi-zalo-official-account.md)
