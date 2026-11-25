# [FLOW-039] Quản Trị & Vận Hành Chiến Dịch Quảng Cáo AI (AI Ads Manager & Autopilot)

> **Tầng nghiệp vụ**: TẦNG 9: MARKETING ĐA KÊNH & CHIẾN DỊCH TỰ ĐỘNG (OMNICHANNEL MARKETING & AUTOPILOT)  
> **Thứ tự thực thi**: 39 / 58  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.

---

## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ

* **Điều kiện tiên quyết**: Đã kết nối Facebook Ads (FLOW-012) và có Landing Page xuất bản (FLOW-024).
* **Tác nhân**: Media Buyer / Nhà quảng cáo.
* **Chi tiết luồng**:
  1. Vào `/ads`, xem tổng quan hiệu quả các chiến dịch Meta Ads và Google Ads.
  2. Tạo bản nháp chiến dịch mới (`AdDraft`):
     - Chọn mục tiêu chiến dịch (Tương tác tin nhắn, Thu thập Lead, Chuyển đổi trên Web).
     - Thiết lập Đối tượng mục tiêu (Targeting: Độ tuổi, Giới tính, Vị trí địa lý, Sở thích hành vi).
     - Thiết lập Ngân sách ngày và Thời gian chạy.
     - Chọn mẫu quảng cáo Creative (Hình ảnh/Video + Nội dung từ FLOW-038).
  3. Đẩy chiến dịch lên Facebook: Gọi API xuất bản chiến dịch lên Ads Manager.
  4. **Chế độ Giám sát Tự động (Ads Autopilot)**:
     - Định kỳ 30 phút, hệ thống đồng bộ chỉ số chi phí (`AdDailyStat`: Impressions, Clicks, CPC, CTR, Spend, Leads).
     - Thuật toán AI phân tích chỉ số theo quy tắc bảo vệ ngân sách (`AdAutomationRule`):
       - *Quy tắc cắt lỗ (Stop-Loss)*: Nếu quảng cáo tiêu hết 200,000 VND mà không sinh ra Lead nào -> Tự động tắt ad set.
       - *Quy tắc tối ưu (Scale-Up)*: Nếu chiến dịch có chi phí trên 1 Lead (CPL) rẻ hơn mục tiêu và ROAS cao -> Tự động tăng 20% ngân sách.
* **Đầu ra**: Tối ưu hóa chi phí quảng cáo, ngăn chặn lãng phí ngân sách doanh nghiệp.
* **Mở khóa**: FLOW-042.

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)

[⬅️ **Luồng trước**: FLOW-038 - Sáng Tạo Nội Dung & Lên Lịch Đăng Bài Tự Động (Content Marketing & Auto-Post)](./FLOW-038-sang-tao-noi-dung-len-lich-dang-bai-tu-dong.md) | [📋 **Mục lục 58 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-040 - Chiến Dịch Email Marketing & Chuỗi Tự Động (Email Marketing & Drip Automation)](./FLOW-040-chien-dich-email-marketing-chuoi-tu-dong.md)
