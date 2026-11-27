# [FLOW-008] Quản lý Chi nhánh & Cơ sở Kinh doanh (Branches)

> **Tầng nghiệp vụ**: TẦNG 2: TỔ CHỨC, CHI NHÁNH, RBAC & GÓI CƯỚC / CREDIT  
> **Thứ tự thực thi**: 8 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-007 (Đã có Tổ chức).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Chủ doanh nghiệp / Quản lý vận hành

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **UI Routes**: `/settings`.
* **API Endpoints**: `GET /api/v1/organizations/branches`, `POST /api/v1/organizations/branches`, `PATCH/DELETE /api/v1/organizations/branches/:id`.
* **Models**: `Branch`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. Khai báo các chi nhánh / cơ sở (`Branch`): tên cơ sở, địa chỉ, số điện thoại, tọa độ GPS / bán kính chấm công.
2. Chỉnh sửa hoặc ngừng hoạt động chi nhánh khi thay đổi quy mô.
3. Các module Lịch hẹn (`Appointment`), Kho hàng (`SalesStockMovement`), Đơn hàng (`SalesOrder`), Nhân sự (`Employee`) đều hỗ trợ lọc và phân tách theo `branchId`.

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: Tên chi nhánh, địa chỉ, thông tin định vị.
* **Đầu ra (Output)**: Danh sách `Branch` thuộc `Organization`.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Không cho xóa chi nhánh đang ràng buộc dữ liệu lịch sử quan trọng mà chuyển sang trạng thái ngưng hoạt động.

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: FLOW-019 (Phòng/Giường Spa), FLOW-021 (Kho chi nhánh), FLOW-054 (Nhân sự chi nhánh)

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-007](./FLOW-007-thiet-lap-to-chuc-ho-so-thuong-hieu-doanh-nghiep.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-009](./FLOW-009-phan-quyen-rbac-bao-ve-tai-nguyen-he-thong.md)
