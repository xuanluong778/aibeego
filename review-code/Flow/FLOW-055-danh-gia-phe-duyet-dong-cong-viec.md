# [FLOW-055] Đánh Giá, Phê Duyệt & Đóng Công Việc (Task Review & Completion)

> **Tầng nghiệp vụ**: TẦNG 13: QUẢN TRỊ DỰ ÁN & TIẾN ĐỘ CÔNG VIỆC (WORK MANAGEMENT - KANBAN & TASKS)  
> **Thứ tự thực thi**: 55 / 58  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.

---

## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ

* **Điều kiện tiên quyết**: Công việc đã được chuyển sang cột Chờ duyệt (FLOW-054).
* **Tác nhân**: Người giao việc / Trưởng dự án.
* **Chi tiết luồng**:
  1. Quản lý nhận thông báo công việc đang chờ duyệt.
  2. Mở thẻ công việc, kiểm tra các tệp đính kèm và checklist:
     - Nếu chưa đạt: Viết bình luận yêu cầu chỉnh sửa, kéo thẻ về `ĐANG LÀM`.
     - Nếu đạt yêu cầu: Đánh giá chất lượng, kéo thẻ sang cột `HOÀN THÀNH` (`WorkTaskReviewEvent`).
  3. Hệ thống ghi nhận tỷ lệ hoàn thành đúng hạn (On-time Delivery Rate) của nhân viên để làm tiêu chí đánh giá KPI cuối tháng.
* **Đầu ra**: Công việc được nghiệm thu chuẩn mực, dữ liệu KPI nhân viên chính xác.

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)

[⬅️ **Luồng trước**: FLOW-054 - Giao Việc, Checklist, Tiến Độ & Log Thời Gian (Task Execution & Time Tracking)](./FLOW-054-giao-viec-checklist-tien-do-log-thoi-gian.md) | [📋 **Mục lục 58 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-056 - Quản Lý Thu - Chi & Sổ Quỹ Dòng Tiền (Finance & Cashflow Ledger)](./FLOW-056-quan-ly-thu-chi-so-quy-dong-tien.md)
