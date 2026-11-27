# [FLOW-031] Đặt Lịch Hẹn Dịch vụ Spa & Kiểm tra Xung đột Phòng/Giường/Kỹ thuật viên

> **Tầng nghiệp vụ**: TẦNG 7: ĐẶT LỊCH HẸN & VẬN HÀNH DỊCH VỤ SPA  
> **Thứ tự thực thi**: 31 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-019 (Dịch vụ, Phòng, Giường), FLOW-028/030 (Khách hàng/Lead), FLOW-054 (Kỹ thuật viên).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Lễ tân / Nhân viên CSKH / Khách hàng

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **UI Routes**: `/appointments`.
* **API Endpoints**: `GET /appointments/calendar`, `GET /appointments/services`, `GET/POST /appointments`, `PATCH /appointments/:id`.
* **Models**: `Appointment`, `Service`, `SpaRoom`, `SpaBed`, `Employee`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. Mở lịch hẹn `/appointments` (xem theo lưới ngày/tuần qua `GET /appointments/calendar`).
2. Tạo lịch hẹn mới (`POST /appointments`): chọn Khách hàng (`customerId`), Chi nhánh (`branchId`), Dịch vụ (`serviceId`), Kỹ thuật viên (`staffId`/`employeeId`), Phòng (`roomId`), Giường (`bedId`), thời gian bắt đầu & kết thúc.
3. Backend kiểm tra xung đột lịch (Overlap check): không cho đặt trùng khung giờ của cùng Kỹ thuật viên hoặc cùng Giường Spa đang bận.
4. Lưu `Appointment` với trạng thái khởi tạo và hiển thị lên bảng lịch chi nhánh.

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: Khách hàng, dịch vụ, chi nhánh, nhân viên, phòng/giường, khung giờ.
* **Đầu ra (Output)**: Lịch hẹn `Appointment` hợp lệ trên lịch vận hành.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Ràng buộc chống đặt trùng lịch KTV và giường dịch vụ.

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: FLOW-032

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-030](./FLOW-030-quan-ly-pipeline-kanban-cham-diem-cham-soc-chuyen-doi-khach-ha.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-032](./FLOW-032-xac-nhan-doi-lich-nhac-lich-tu-dong-hoan-tat-dich-vu.md)
