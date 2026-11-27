# [FLOW-034] Tạo Đơn hàng Bán lẻ POS/Online với Chiết khấu Dòng & Chiết khấu Đơn

> **Tầng nghiệp vụ**: TẦNG 8: BÁN HÀNG, ĐƠN HÀNG, THANH TOÁN & ĐỔI TRẢ  
> **Thứ tự thực thi**: 34 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-017/021 (Sản phẩm `SalesProduct` & tồn kho), FLOW-028 (Khách hàng `Customer`).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Nhân viên bán hàng / Thu ngân

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **UI Routes**: `/sales/orders`.
* **API Endpoints**: `GET/POST/PATCH /sales/orders`, `GET /sales/orders/:id`, `GET /sales/products/lookup`.
* **Models**: `SalesOrder`, `SalesOrderItem`, `SalesDocumentSequence`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. Mở `/sales/orders` -> chọn Khách hàng (`customerId`, `customerName`, `phone`, `address`), Chi nhánh, Nguồn đơn (`source`).
2. Tra cứu và thêm từng sản phẩm (`SalesOrderItem`): nhập số lượng `qty`, đơn giá `unitPrice` và chiết khấu từng dòng `lineDiscount`. Hệ thống tính `line.totalPrice = Math.max(0, qty * unitPrice - lineDiscount)`.
3. Nhập chiết khấu toàn đơn (`discount`) và phí vận chuyển (`shippingFee`).
4. Backend tính tổng: `subtotal = sum(lines.totalPrice)`, `total = Math.max(0, subtotal - discount + shippingFee)`.
5. Sinh mã đơn tự động `SO-YYYYMMDD-XXXX` với `status = DRAFT` và `paymentStatus = UNPAID`.

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: Khách hàng, danh sách `SalesOrderItem` (`qty`, `unitPrice`, `lineDiscount`), `discount`, `shippingFee`.
* **Đầu ra (Output)**: Bản ghi `SalesOrder` kèm tổng tiền phải thu tính toán ở backend.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Tách biệt vòng đời thanh toán (`paymentStatus`: `UNPAID/PARTIAL/PAID/REFUNDED`) khỏi vòng đời vận hành đơn (`status`). Backend tính lại toàn bộ tiền chống sửa payload.

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: FLOW-035, FLOW-036

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-033](./FLOW-033-tao-don-hang-dich-vu-spa-thu-tien-tai-quay.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-035](./FLOW-035-xu-ly-thanh-toan-don-ban-le-hoan-tien-truc-tiep.md)
