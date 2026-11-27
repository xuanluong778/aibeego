# [FLOW-058] Thực thi Checklist Giao riêng Theo Hạng mục, Log Thời gian & Duyệt Hoàn thành Task

> **Tầng nghiệp vụ**: TẦNG 14: QUẢN TRỊ NHÂN SỰ (HRM), CA KÍP, CHẤM CÔNG & CÔNG VIỆC  
> **Thứ tự thực thi**: 58 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-057 (Đã có Thẻ công việc `WorkTask`).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Người thực hiện hạng mục + Người giao việc / Người duyệt

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **DB Migration**: `20261127120000_work_checklist_item_assignee_dates` (`WorkChecklistItem`: `assigneeId`, `startDate`, `dueDate`).
* **Frontend Components**: `work-checklist-item-row.tsx` (`WorkChecklistItemRow`), `work-task-detail-modal.tsx`, `lib/work-task-detail.ts`.
* **API Endpoints**: `PATCH /work-management/tasks/:id`, `POST /work-management/tasks/:id/time/start|pause|stop|manual`, `GET/POST/PATCH/DELETE /work-management/tasks/:id/comments|files`, `POST /work-management/tasks/:id/submit-review|approve|request-fix`, `GET /work-management/notifications*`.
* **Models**: `WorkChecklistItem`, `WorkTimeLog`, `WorkTaskComment`, `WorkAttachment`, `WorkTaskStatusHistory`, `WorkTaskReviewEvent`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. **Checklist thông minh theo hạng mục (`WorkChecklistItemRow`)**: Hỗ trợ thêm nhiều hạng mục liên tiếp (multi-add). Rê chuột vào từng dòng checklist có 3 thao tác: (1) Đặt ngày bắt đầu/hết hạn (`startDate`, `dueDate` kèm cảnh báo quá hạn), (2) Giao riêng hạng mục cho một nhân viên (`assigneeId`), (3) Menu `...` để **Chuyển thành thẻ mới** hoặc Xóa.
2. **Quy tắc tự động theo dõi & thông báo Checklist**: Khi gán nhân viên vào một hạng mục checklist, Backend (`WorkManagementService.updateTask`) kiểm tra nhân viên thuộc tổ chức, **tự động thêm họ vào `WorkTaskWatcher`** (nếu chưa là người thực hiện/theo dõi thẻ) để họ nhìn thấy và tick được việc của mình, đồng thời gửi thông báo *"Được giao hạng mục: ..."*.
3. **Thực thi & Log giờ**: Thành viên bấm bắt đầu/tạm dừng/dừng đồng hồ đo thời gian (`time/start|pause|stop|manual`), đính kèm file và trao đổi qua comment.
4. **Quy trình Duyệt**: Hoàn thành xong bấm **Gửi duyệt** (`submit-review`) -> Người giao/Quản lý kiểm tra và bấm **Phê duyệt** (`approve`) hoặc **Yêu cầu sửa** (`request-fix`), lưu toàn bộ lịch sử vào `WorkTaskStatusHistory` & `WorkTaskReviewEvent`.

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: Cập nhật checklist (title, `isDone`, `assigneeId`, `startDate`, `dueDate`), log thời gian, tệp, lệnh review.
* **Đầu ra (Output)**: Hạng mục & thẻ công việc được hoàn thành, dữ liệu hiệu suất nhân viên (`employees/:employeeId/stats`, `reports/export`) được tính chính xác.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Kiểm tra `dueDate >= startDate` ở cả frontend lẫn backend; tránh gửi thông báo trùng lặp nếu nhân viên vừa nhận thông báo giao thẻ cha.

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: FLOW-061 (Báo cáo năng suất nhân sự & Audit log)

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-057](./FLOW-057-khoi-tao-du-an-bang-kanban-giao-viec-hien-thi-thanh-vien.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-059](./FLOW-059-quan-ly-thu-chi-tong-hop-so-quy-dong-tien.md)
