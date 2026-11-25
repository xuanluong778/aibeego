# [FLOW-029] Chăm Sóc Lead, Ghi Chú & Lịch Nhắc Việc (Lead Notes & CRM Tasks)

> **Tầng nghiệp vụ**: TẦNG 6: QUẢN LÝ QUAN HỆ KHÁCH HÀNG & PHÂN LOẠI LEAD (CRM & LEAD NURTURING)  
> **Thứ tự thực thi**: 29 / 58  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.

---

## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ

* **Điều kiện tiên quyết**: Lead đang trong quá trình tư vấn (FLOW-028).
* **Tác nhân**: Nhân viên kinh doanh / Chăm sóc khách hàng.
* **Chi tiết luồng**:
  1. Nhân viên gọi điện tư vấn cho khách.
  2. Mở màn hình chi tiết Lead trên CRM:
     - Thêm ghi chú cuộc gọi (`LeadNote`): Nhu cầu của khách, tình trạng da/sức khỏe, ngân sách khách có thể chi trả, rào cản còn băn khoăn.
     - Tạo công việc nhắc nhở (`CrmTask`): "Gọi lại vào 14:00 ngày mai gửi bảng báo giá liệu trình".
  3. Đến hạn công việc: Hệ thống gửi thông báo nhắc nhở nhân viên trên thanh công cụ và chuông báo.
* **Đầu ra**: Lịch sử tương tác của khách hàng được lưu trữ trọn đời, nhân viên khác có thể tiếp quản mà không bị mất ngữ cảnh.
* **Mở khóa**: FLOW-030 (Khách chốt đặt hẹn), FLOW-034 (Khách chốt mua sản phẩm).

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)

[⬅️ **Luồng trước**: FLOW-028 - Chấm Điểm Tiềm Năng & Quản Lý Giai Đoạn Phễu (Lead Scoring & Pipeline)](./FLOW-028-cham-diem-tiem-nang-quan-ly-giai-doan-pheu.md) | [📋 **Mục lục 58 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-030 - Đặt Lịch Hẹn Dịch Vụ (Appointment Booking)](./FLOW-030-dat-lich-hen-dich-vu.md)
