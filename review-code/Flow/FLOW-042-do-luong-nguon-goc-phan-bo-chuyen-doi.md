# [FLOW-042] Đo Lường Nguồn Gốc & Phân Bổ Chuyển Đổi (Attribution & Meta CAPI)

> **Tầng nghiệp vụ**: TẦNG 9: MARKETING ĐA KÊNH & CHIẾN DỊCH TỰ ĐỘNG (OMNICHANNEL MARKETING & AUTOPILOT)  
> **Thứ tự thực thi**: 42 / 58  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.

---

## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ

* **Điều kiện tiên quyết**: Có Chiến dịch quảng cáo (FLOW-039), Lead (FLOW-025, FLOW-026) và Đơn hàng thanh toán (FLOW-035).
* **Tác nhân**: Động cơ Attribution Engine + Offline Conversion Worker.
* **Chi tiết luồng**:
  1. Theo vết toàn diện hành trình người dùng (Multi-touch Attribution):
     - Khách nhấp vào quảng cáo Facebook (lưu `fbclid` và UTM Campaign).
     - Khách vào Landing Page, điền form thành Lead (`LeadAttribution`).
     - 3 ngày sau, khách đến spa làm dịch vụ và thanh toán đơn hàng 5,000,000 VND (`SalesOrder`).
  2. Hệ thống liên kết chính xác đơn hàng 5,000,000 VND đó về chiến dịch quảng cáo ban đầu đã mang khách hàng về.
  3. Bắn ngược dữ liệu chuyển đổi về Meta / Google (`OfflineConversionJob`):
     - Gửi sự kiện `Purchase` kèm giá trị tiền về Meta Conversion API (CAPI) và Google Offline Conversion.
     - Thuật toán máy học AI của Facebook/Google nhận được dữ liệu khách trả tiền thật sẽ thông minh hơn, tự động tối ưu phân phối quảng cáo tới những người có chân dung tương tự.
* **Đầu ra**: Báo cáo chỉ số ROAS (Doanh thu / Chi phí quảng cáo) chuẩn xác đến từng đồng.
* **Mở khóa**: FLOW-058 (Báo cáo kinh doanh cấp cao).

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)

[⬅️ **Luồng trước**: FLOW-041 - Chiến Dịch Tin Nhắn Zalo ZNS & Messaging Broadcast](./FLOW-041-chien-dich-tin-nhan-zalo-zns-messaging-broadcast.md) | [📋 **Mục lục 58 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-043 - Xây Dựng Cơ Sở Tri Thức Doanh Nghiệp (RAG Knowledge Base)](./FLOW-043-xay-dung-co-so-tri-thuc-doanh-nghiep.md)
