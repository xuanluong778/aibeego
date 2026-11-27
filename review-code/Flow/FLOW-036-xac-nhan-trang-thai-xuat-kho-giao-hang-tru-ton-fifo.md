# [FLOW-036] Xác nhận Trạng thái, Xuất kho Giao hàng & Trừ tồn FIFO (`Export`)

> **Tầng nghiệp vụ**: TẦNG 8: BÁN HÀNG, ĐƠN HÀNG, THANH TOÁN & ĐỔI TRẢ  
> **Thứ tự thực thi**: 36 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-034 (Có đơn `SalesOrder`) & FLOW-021 (Có tồn kho `SalesStockBatch`).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Nhân viên xử lý đơn / Thủ kho

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **UI Routes**: `/sales/orders`, `/sales/stock-movements`.
* **API Endpoints**: `POST /sales/orders/:id/status`, `POST /sales/orders/:id/export`.
* **Models**: `SalesOrder`, `SalesStockBatch`, `SalesStockMovement`, `SalesStockMovementLine`, `SalesOperationIdempotency`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. Cập nhật tiến trình đơn (`POST /sales/orders/:id/status`): `DRAFT` -> `CONFIRMED` -> `READY` -> `SHIPPED` -> `COMPLETED` (hoặc `CANCELLED`).
2. Khi bấm nút **Xuất hàng** (`POST /sales/orders/:id/export`):
3. 1. Kiểm tra tồn kho khả dụng từng sản phẩm trong đơn.
4. 2. Tự động trừ tồn kho theo nguyên tắc lô FIFO (lô hết hạn trước xuất trước) trên `SalesStockBatch`.
5. 3. Sinh chứng từ xuất kho `SalesStockMovement` (loại `OUT`) và ghi nhận `exportedAt`, `exportedById` trên `SalesOrder`.

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: Lệnh chuyển trạng thái / Xuất kho cho `SalesOrder`.
* **Đầu ra (Output)**: Đơn hàng đã xuất kho (`exportedAt`), tồn kho trừ chuẩn theo từng lô.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Chỉ cho phép xuất kho 1 lần duy nhất (chặn xuất trùng bằng `exportedAt` + transaction + `SalesOperationIdempotency`); báo lỗi nếu thiếu tồn.

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: FLOW-037 (Nếu phát sinh đổi trả sau xuất hàng)

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-035](./FLOW-035-xu-ly-thanh-toan-don-ban-le-hoan-tien-truc-tiep.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-037](./FLOW-037-doi-tra-hang-phan-bo-hoan-tra-doanh-thu-nhap-lai-kho.md)
