# [FLOW-033] Tạo Đơn hàng Dịch vụ Spa & Thu tiền tại Quầy (Service Orders)

> **Tầng nghiệp vụ**: TẦNG 8: BÁN HÀNG, ĐƠN HÀNG, THANH TOÁN & ĐỔI TRẢ  
> **Thứ tự thực thi**: 33 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-019 (Dịch vụ `Service`), FLOW-028 (Khách hàng `Customer`), FLOW-032 (Lịch hẹn nếu gắn dịch vụ).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Thu ngân / Lễ tân / Kế toán

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **UI Routes**: `/finance`, `/appointments`.
* **API Endpoints**: `GET/POST /finance/orders`, `POST /finance/orders/:id/cancel`, `GET/POST /finance/payments`, `POST /finance/payments/:id/refund`.
* **Models**: `Order`, `OrderItem`, `Payment`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. Tạo đơn dịch vụ (`POST /finance/orders`) chọn Khách hàng, Chi nhánh, `leadId` (nếu có) và danh sách các dịch vụ (`OrderItem` gắn `serviceId`, đơn giá, số lượng).
2. Áp dụng chiết khấu trực tiếp trên đơn (`discount`) -> tính `subtotal` và `total = subtotal - discount`.
3. Thu ngân ghi nhận thanh toán (`POST /finance/payments`) theo phương thức (`CASH`, chuyển khoản, thẻ...) -> cập nhật trạng thái thanh toán.
4. Nếu khách hủy hoặc hoàn trả tiền dịch vụ: dùng `POST /finance/orders/:id/cancel` hoặc `POST /finance/payments/:id/refund`.

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: Khách hàng, danh sách `OrderItem` dịch vụ, chiết khấu, số tiền & phương thức thanh toán.
* **Đầu ra (Output)**: Hóa đơn dịch vụ `Order` và giao dịch `Payment` hạch toán vào sổ thu.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Kiểm tra quyền `finance.rbac.ts`, không cho hoàn tiền vượt quá số đã thanh toán.

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: FLOW-059 (Thu chi dòng tiền), FLOW-043 (Attribution)

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-032](./FLOW-032-xac-nhan-doi-lich-nhac-lich-tu-dong-hoan-tat-dich-vu.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-034](./FLOW-034-tao-don-hang-ban-le-pos-online-voi-chiet-khau-dong-chiet-khau-.md)
