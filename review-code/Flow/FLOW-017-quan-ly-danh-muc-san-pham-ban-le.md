# [FLOW-017] Quản lý Danh mục & Sản phẩm Bán lẻ (SKU, Barcode, Giá vốn & Giá bán)

> **Tầng nghiệp vụ**: TẦNG 4: DANH MỤC SẢN PHẨM, DỊCH VỤ SPA & QUẢN TRỊ KHO  
> **Thứ tự thực thi**: 17 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-007 (Đã có Tổ chức).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Quản lý sản phẩm / Thủ kho

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **UI Routes**: `/sales/products`.
* **API Endpoints**: `GET/POST /sales/categories`, `GET/POST/PATCH /sales/products`, `GET /sales/products/lookup`.
* **Models**: `SalesProductCategory`, `SalesProduct`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. Tạo cấu trúc danh mục sản phẩm (`POST /sales/categories`).
2. Tạo/cập nhật sản phẩm (`POST/PATCH /sales/products`): mã SKU, Barcode, tên sản phẩm, đơn vị tính, giá vốn, giá bán lẻ, ngưỡng cảnh báo tồn tối thiểu, ảnh sản phẩm.
3. Hỗ trợ tra cứu nhanh sản phẩm bằng mã vạch / SKU / từ khóa (`GET /sales/products/lookup`) khi bán hàng POS hoặc kiểm kho.

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: Thông tin danh mục và sản phẩm (`sku`, `barcode`, `price`, `costPrice`, `minStock`...).
* **Đầu ra (Output)**: Danh mục `SalesProduct` chuẩn hóa trong hệ thống.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Ràng buộc duy nhất mã SKU/Barcode trong cùng tổ chức (`organizationId`).

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: FLOW-018, FLOW-020, FLOW-021, FLOW-023, FLOW-034

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-016](./FLOW-016-cau-hinh-ten-mien-gui-email-webhook-chuyen-phat.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-018](./FLOW-018-nhap-san-pham-hang-loat-tu-excel-dong-bo-cua-hang-woocommerce.md)
