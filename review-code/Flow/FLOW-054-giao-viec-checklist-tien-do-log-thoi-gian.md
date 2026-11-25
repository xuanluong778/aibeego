# [FLOW-054] Giao Việc, Checklist, Tiến Độ & Log Thời Gian (Task Execution & Time Tracking)

> **Tầng nghiệp vụ**: TẦNG 13: QUẢN TRỊ DỰ ÁN & TIẾN ĐỘ CÔNG VIỆC (WORK MANAGEMENT - KANBAN & TASKS)  
> **Thứ tự thực thi**: 54 / 58  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.

---

## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ

* **Điều kiện tiên quyết**: Đã có Dự án và Bảng Kanban (FLOW-053).
* **Tác nhân**: Người giao việc + Người thực hiện.
* **Chi tiết luồng**:
  1. Trưởng nhóm tạo Thẻ công việc (`WorkTask`):
     - Tiêu đề công việc, Mô tả yêu cầu cụ thể.
     - Gán người thực hiện chính (`WorkTaskAssignee`) và người theo dõi (`WorkTaskWatcher`).
     - Hạn chót hoàn thành (Due Date) và Mức độ ưu tiên (Khẩn cấp, Cao, Trung bình, Thấp).
     - Tạo danh sách công việc con cần tích (`WorkChecklistItem`).
  2. Nhân viên tiếp nhận công việc:
     - Kéo thẻ sang cột `ĐANG LÀM`.
     - Bấm nút "Bắt đầu tính giờ" (`WorkTimeLog`) để đo chính xác thời gian thực tế bỏ ra làm task.
     - Đính kèm tệp kết quả (`WorkAttachment`), bình luận trao đổi (`WorkTaskComment`).
  3. Khi làm xong, nhân viên kéo thẻ sang cột `CHỜ DUYỆT`.
* **Đầu ra**: Tiến độ công việc được cập nhật minh bạch theo thời gian thực.
* **Mở khóa**: FLOW-055.

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)

[⬅️ **Luồng trước**: FLOW-053 - Khởi Tạo Dự Án & Bảng Công Việc Kanban (Work Projects & Boards)](./FLOW-053-khoi-tao-du-an-bang-cong-viec-kanban.md) | [📋 **Mục lục 58 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-055 - Đánh Giá, Phê Duyệt & Đóng Công Việc (Task Review & Completion)](./FLOW-055-danh-gia-phe-duyet-dong-cong-viec.md)
