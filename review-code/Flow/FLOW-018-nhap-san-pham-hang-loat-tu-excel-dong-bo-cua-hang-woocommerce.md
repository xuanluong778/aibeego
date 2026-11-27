# [FLOW-018] Nhập Sản phẩm Hàng loạt từ Excel & Đồng bộ Cửa hàng WooCommerce

> **Tầng nghiệp vụ**: TẦNG 4: DANH MỤC SẢN PHẨM, DỊCH VỤ SPA & QUẢN TRỊ KHO  
> **Thứ tự thực thi**: 18 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-017 (Đã có hệ thống danh mục/sản phẩm).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Quản trị bán hàng / Vận hành E-commerce

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **UI Routes**: `/sales/products`.
* **API Endpoints**: `GET /sales/product-imports/template`, `POST /sales/product-imports`, `POST /sales/product-imports/:id/preview|confirm|process|retry`, `GET/POST /sales/woocommerce`, `GET/POST /sales/woocommerce/:id/categories|category-url|products|import`.
* **Models**: `SalesProductImport`, `SalesProductImportRow`, `WooCommerceConnection`, `WooCommerceProduct`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. **Luồng Import Excel**: Tải file mẫu (`product-imports/template`) -> Upload file Excel/CSV -> Chạy xem trước (`preview`) kiểm tra lỗi từng dòng (`SalesProductImportRow`) -> Xác nhận (`confirm`) & xử lý nền (`process`). Xuất báo cáo dòng lỗi (`report.csv`).
2. **Luồng Đồng bộ WooCommerce**: Thêm kết nối WooCommerce (`POST /sales/woocommerce` với Site URL & Consumer Key/Secret, bảo vệ SSRF) -> Lấy danh mục/sản phẩm từ WooCommerce (`:id/products`) -> Bấm đồng bộ (`:id/import`) để tạo hoặc cập nhật `SalesProduct`.

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: File Excel/CSV sản phẩm hoặc WooCommerce REST Credentials.
* **Đầu ra (Output)**: Hàng loạt sản phẩm được chuẩn hóa và cập nhật vào kho danh mục.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Tách rõ nguồn sản phẩm (`sales-product-source.ts`), chống SSRF khi kết nối URL WooCommerce, hỗ trợ retry dòng lỗi.

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: FLOW-020, FLOW-034

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-017](./FLOW-017-quan-ly-danh-muc-san-pham-ban-le.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-019](./FLOW-019-quan-ly-dich-vu-spa-phong-giuong-thiet-bi.md)
