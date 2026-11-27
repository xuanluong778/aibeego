# [FLOW-057] Khởi tạo Dự án, Bảng Kanban, Giao việc & Hiển thị Thành viên (`WorkProject` / `WorkTask`)

> **Tầng nghiệp vụ**: TẦNG 14: QUẢN TRỊ NHÂN SỰ (HRM), CA KÍP, CHẤM CÔNG & CÔNG VIỆC  
> **Thứ tự thực thi**: 57 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-054 (Đã có danh sách Nhân viên `Employee` thuộc Tổ chức).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Trưởng dự án / Quản lý / Nhân viên

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **UI Routes**: `/work-management`, `/work-management/my`, `/work-management/calendar`, `/work-management/dashboard`.
* **API Endpoints**: `GET/POST/PATCH /work-management/projects`, `GET/POST /work-management/projects/:id/documents`, `PATCH /work-management/columns/:id`, `GET/POST/PATCH/DELETE /work-management/tasks`, `POST /work-management/tasks/:id/move|copy|archive|unarchive`, `GET /work-management/my-work|calendar|dashboard`.
* **Frontend Components**: `work-task-card-popovers.tsx` (`WorkTaskMemberAvatars`), `work-task-detail-modal.tsx`.
* **Models**: `WorkProject`, `WorkBoardColumn`, `WorkTask`, `WorkTaskAssignee`, `WorkTaskWatcher`, `WorkNotification`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. Tạo Dự án (`POST /work-management/projects`) kèm các cột trạng thái Kanban (`WorkBoardColumn`) và tài liệu dự án (`projects/:id/documents`).
2. Tạo Thẻ công việc (`POST /work-management/tasks`): tiêu đề, mô tả, trường tùy chỉnh (`customFields`), ngày bắt đầu/hạn chót (`startDate`, `deadline`), người thực hiện (`assigneeIds`), người theo dõi (`watcherIds`).
3. Trên giao diện modal chi tiết thẻ (`work-task-detail-modal.tsx`), thanh trên cùng hiển thị danh sách avatar tròn viết tắt tên của tối đa 6 thành viên (`WorkTaskMemberAvatars` + bubble `+N`) ngay cạnh email người phụ trách chính.
4. Kéo thả thẻ giữa các cột (`tasks/:id/move`), xem lịch việc (`calendar`), việc của tôi (`my-work`) hoặc nhân bản/lưu trữ thẻ (`copy`, `archive`).

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: Thông tin dự án, cột Kanban, nội dung công việc và danh sách thành viên.
* **Đầu ra (Output)**: Bảng công việc trực quan, thông báo giao việc tự động gửi tới thành viên.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* `assertEmployeesInOrg` đảm bảo chỉ giao việc cho nhân sự thuộc cùng `organizationId`; phân quyền xem/sửa theo `resolveWorkScope`.

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: FLOW-058

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-056](./FLOW-056-cham-cong-qr-dong-quan-ly-nghi-phep-tang-ca-chot-bang-cong-tha.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-058](./FLOW-058-thuc-thi-checklist-giao-rieng-theo-hang-muc-log-thoi-gian-duye.md)
