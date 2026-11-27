# [FLOW-020] Quản lý Nhà cung cấp & Đơn Đặt Mua Hàng (Suppliers & Purchase Orders)

> **Tầng nghiệp vụ**: TẦNG 4: DANH MỤC SẢN PHẨM, DỊCH VỤ SPA & QUẢN TRỊ KHO  
> **Thứ tự thực thi**: 20 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-017 (Đã có danh mục `SalesProduct`).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Nhân viên thu mua / Kế toán kho

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **UI Routes**: `/sales/purchases`.
* **API Endpoints**: `GET/POST /sales/suppliers`, `GET/POST /sales/purchase-orders`, `GET /sales/purchase-orders/:id`.
* **Models**: `SalesSupplier`, `SalesPurchaseOrder`, `SalesPurchaseOrderItem`, `SalesDocumentSequence`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. Tạo hồ sơ Nhà cung cấp (`POST /sales/suppliers`): tên, mã, SĐT, email, địa chỉ, điều khoản thanh toán.
2. Lập Đơn mua hàng PO (`POST /sales/purchase-orders`): chọn nhà cung cấp, chi nhánh nhận, danh sách sản phẩm (`SalesPurchaseOrderItem`), số lượng đặt và giá nhập dự kiến.
3. Hệ thống tự động cấp mã chứng từ tuần tự (`SalesDocumentSequence`).

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: Nhà cung cấp, danh sách mặt hàng, số lượng đặt và đơn giá nhập.
* **Đầu ra (Output)**: Đơn đặt mua hàng `SalesPurchaseOrder` sẵn sàng chờ nhận hàng.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Định danh mã chứng từ duy nhất, không trùng lặp.

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: FLOW-021 (Nhận hàng & Nhập kho theo lô)

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-019](./FLOW-019-quan-ly-dich-vu-spa-phong-giuong-thiet-bi.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-021](./FLOW-021-nhap-kho-theo-lo-hsd-xuat-dieu-chinh-canh-bao-ton-kho.md)
