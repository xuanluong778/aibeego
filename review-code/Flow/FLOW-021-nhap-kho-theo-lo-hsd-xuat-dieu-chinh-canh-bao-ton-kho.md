# [FLOW-021] Nhập Kho Theo Lô/HSD (FIFO), Xuất/Điều chỉnh & Cảnh báo Tồn kho

> **Tầng nghiệp vụ**: TẦNG 4: DANH MỤC SẢN PHẨM, DỊCH VỤ SPA & QUẢN TRỊ KHO  
> **Thứ tự thực thi**: 21 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-020 (Có đơn PO cần nhận) hoặc FLOW-017 (Có sản phẩm nhập/xuất trực tiếp).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Thủ kho / Quản lý chi nhánh

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **UI Routes**: `/sales/inventory`, `/sales/stock-movements`.
* **API Endpoints**: `POST /sales/purchase-orders/:id/receive`, `POST /sales/stock/inbound`, `POST /sales/stock/outbound`, `POST /sales/stock/adjust`, `GET /sales/stock/batches`, `GET /sales/stock/movements`, `GET /sales/stock/alerts`.
* **Models**: `SalesStockBatch`, `SalesStockMovement`, `SalesStockMovementLine`, `SalesOperationIdempotency`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. Nhận hàng từ đơn PO (`POST /sales/purchase-orders/:id/receive`) hoặc nhập kho trực tiếp (`POST /sales/stock/inbound`): ghi nhận số lượng thực nhận, số lô (`batchCode`), ngày sản xuất và hạn sử dụng vào `SalesStockBatch`.
2. Sinh chứng từ nhập kho (`SalesStockMovement` + `SalesStockMovementLine`) và cập nhật số lượng tồn khả dụng.
3. Khi xuất kho thủ công (`outbound`) hoặc điều chỉnh (`adjust`), hệ thống ghi nhận biến động chi tiết từng dòng lô hàng.
4. Màn hình `/sales/inventory` & API `GET /sales/stock/alerts` tự động cảnh báo mặt hàng dưới mức tồn tối thiểu hoặc lô sắp hết hạn.

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: Dữ liệu nhận hàng PO / lệnh nhập-xuất-điều chỉnh kho kèm thông tin lô.
* **Đầu ra (Output)**: Lô hàng `SalesStockBatch` tồn kho thực tế, lịch sử `SalesStockMovement`.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Dùng `SalesOperationIdempotency` chống nhấn đúp gây nhập/xuất kho 2 lần; bảo toàn thứ tự FIFO.

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: FLOW-022 (Kiểm kê), FLOW-034 & FLOW-036 (Bán hàng & Xuất hàng FIFO)

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-020](./FLOW-020-quan-ly-nha-cung-cap-don-dat-mua-hang.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-022](./FLOW-022-kiem-ke-kho-doi-soat-sai-lech-ton-kho.md)
