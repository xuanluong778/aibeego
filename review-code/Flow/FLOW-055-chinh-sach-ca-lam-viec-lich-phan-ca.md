# [FLOW-055] Chính sách Ca làm việc (`WorkShiftPolicy`) & Lịch Phân ca (`ShiftAssignment`)

> **Tầng nghiệp vụ**: TẦNG 14: QUẢN TRỊ NHÂN SỰ (HRM), CA KÍP, CHẤM CÔNG & CÔNG VIỆC  
> **Thứ tự thực thi**: 55 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-054 (Đã có danh sách Nhân viên `Employee`).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Trưởng ca / Quản lý chi nhánh / HR

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **UI Routes**: `/hrm/shifts`.
* **API Endpoints**: `GET/POST/PATCH/DELETE /hrm/shift-policies`, `POST /hrm/shift-policies/:id/activate|deactivate`, `GET /hrm/shift-assignments/calendar`, `GET/POST/PATCH/DELETE /hrm/shift-assignments`, `POST /hrm/shift-assignments/bulk`.
* **Models**: `WorkShiftPolicy`, `WorkShiftPolicyVersion`, `ShiftAssignment`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. Cấu hình chính sách ca (`WorkShiftPolicy`): giờ bắt đầu, giờ kết thúc, thời gian nghỉ giữa ca, số phút ân hạn đi muộn/về sớm (mỗi lần sửa tạo `WorkShiftPolicyVersion` giữ lịch sử cho bảng công cũ).
2. Lập lịch phân ca cho nhân viên trên giao diện lịch (`/hrm/shifts`, API `shift-assignments/calendar`) theo từng ngày hoặc xếp hàng loạt (`POST /hrm/shift-assignments/bulk`).
3. Kích hoạt hoặc tạm ngưng chính sách ca không còn sử dụng.

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: Khung giờ ca làm việc, danh sách nhân viên và ngày trực.
* **Đầu ra (Output)**: Lịch phân ca `ShiftAssignment` rõ ràng làm chuẩn đối chiếu chấm công.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Phiên bản hóa `WorkShiftPolicyVersion` để sửa giờ ca hôm nay không làm sai lệch công của tháng trước.

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: FLOW-056 (Chấm công QR đối chiếu đúng ca)

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-054](./FLOW-054-quan-ly-nhan-su-phong-ban-hop-dong-ho-so-cap-tai-khoan-he-thon.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-056](./FLOW-056-cham-cong-qr-dong-quan-ly-nghi-phep-tang-ca-chot-bang-cong-tha.md)
