# [FLOW-035] Xử lý Thanh toán Đơn Bán lẻ & Hoàn tiền Trực tiếp

> **Tầng nghiệp vụ**: TẦNG 8: BÁN HÀNG, ĐƠN HÀNG, THANH TOÁN & ĐỔI TRẢ  
> **Thứ tự thực thi**: 35 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-034 (Đã có đơn `SalesOrder`).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Thu ngân / Kế toán / Khách hàng

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **UI Routes**: `/sales/orders`.
* **API Endpoints**: `GET /sales/orders/:id/payments`, `POST /sales/orders/:id/payments`, `POST /sales/orders/:id/refunds`.
* **Models**: `SalesOrder`, `SalesPayment`, `SalesOperationIdempotency`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. Khách thanh toán một phần (đặt cọc) hoặc toàn bộ đơn hàng qua `POST /sales/orders/:id/payments`.
2. Hệ thống ghi nhận `SalesPayment`, cộng dồn `amountPaid`, tính `amountDue = Math.max(0, total - amountPaid)`.
3. Tự động cập nhật `paymentStatus`: `UNPAID` -> `PARTIAL` (nếu 0 < `amountPaid` < `total`) -> `PAID` (nếu `amountPaid` >= `total`).
4. Trường hợp thanh toán thừa hoặc hủy/giảm đơn: thực hiện hoàn tiền (`POST /sales/orders/:id/refunds`) căn cứ trên `amountRefundable`.

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: Số tiền thu/hoàn, phương thức thanh toán, mã tham chiếu giao dịch.
* **Đầu ra (Output)**: Bản ghi `SalesPayment`, trạng thái `paymentStatus` chính xác.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Sử dụng khóa idempotency chống ghi nhận thanh toán trùng; cập nhật `amountPaid` trong DB transaction.

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: FLOW-036, FLOW-043 (Attribution), FLOW-052 (Hoa hồng Affiliate), FLOW-059 (Tài chính)

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-034](./FLOW-034-tao-don-hang-ban-le-pos-online-voi-chiet-khau-dong-chiet-khau-.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-036](./FLOW-036-xac-nhan-trang-thai-xuat-kho-giao-hang-tru-ton-fifo.md)
