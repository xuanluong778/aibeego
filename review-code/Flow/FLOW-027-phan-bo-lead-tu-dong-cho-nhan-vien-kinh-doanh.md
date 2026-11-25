# [FLOW-027] Phân Bổ Lead Tự Động Cho Nhân Viên Kinh Doanh (Lead Assignment Engine)

> **Tầng nghiệp vụ**: TẦNG 6: QUẢN LÝ QUAN HỆ KHÁCH HÀNG & PHÂN LOẠI LEAD (CRM & LEAD NURTURING)  
> **Thứ tự thực thi**: 27 / 58  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.

---

## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ

* **Điều kiện tiên quyết**: Đã tiếp nhận Lead vào hệ thống (FLOW-026) và đã có danh sách Nhân viên/Sales (FLOW-049).
* **Tác nhân**: Động cơ phân bổ tự động (Assignment Engine).
* **Chi tiết luồng**:
  1. Hệ thống đọc các quy tắc phân bổ đang kích hoạt (`LeadAssignmentRule`):
     - **Quy tắc Vòng tròn (Round-Robin)**: Chia đều lần lượt cho từng nhân viên kinh doanh trong nhóm.
     - **Quy tắc Chi nhánh (Branch-based)**: Khách chọn chi nhánh nào thì phân bổ cho nhân viên của chi nhánh đó.
     - **Quy tắc Ca làm việc (Shift-based)**: Chỉ phân bổ cho nhân viên đang trong ca trực hoạt động (dựa vào FLOW-050).
  2. Gán `assignedToUserId` cho bản ghi `Lead`.
  3. Hệ thống bắn thông báo tức thì (Realtime WebSockets Notification & Push Notification) tới điện thoại/máy tính của nhân viên được phân công: *"Bạn vừa có 1 khách hàng mới cần liên hệ ngay!"*.
* **Đầu ra**: Lead có nhân viên chịu trách nhiệm xử lý trong vòng 5-15 phút đầu tiên (Golden Time).
* **Mở khóa**: FLOW-028, FLOW-029.

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)

[⬅️ **Luồng trước**: FLOW-026 - Tiếp Nhận Lead, Khử Trùng Lặp & Hợp Nhất Khách Hàng (Lead Ingestion & Deduplication)](./FLOW-026-tiep-nhan-lead-khu-trung-lap-hop-nhat-khach-hang.md) | [📋 **Mục lục 58 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-028 - Chấm Điểm Tiềm Năng & Quản Lý Giai Đoạn Phễu (Lead Scoring & Pipeline)](./FLOW-028-cham-diem-tiem-nang-quan-ly-giai-doan-pheu.md)
