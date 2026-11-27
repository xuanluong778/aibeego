# [FLOW-022] Kiểm kê Kho (Stocktake) & Đối soát Sai lệch Tồn kho (Reconcile)

> **Tầng nghiệp vụ**: TẦNG 4: DANH MỤC SẢN PHẨM, DỊCH VỤ SPA & QUẢN TRỊ KHO  
> **Thứ tự thực thi**: 22 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-021 (Kho đã có giao dịch và số dư tồn kho).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Thủ kho / Kế toán kiểm kê

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **UI Routes**: `/sales/stocktake`, `/sales/inventory`.
* **API Endpoints**: `GET/POST /sales/stocktakes`, `GET /sales/stocktakes/:id`, `PATCH /sales/stocktakes/:id/lines`, `POST /sales/stocktakes/:id/confirm`, `POST /sales/stocktakes/:id/cancel`, `GET /sales/stock/reconcile`, `POST /sales/stock/reconcile/fix`.
* **Models**: `SalesStocktake`, `SalesStocktakeLine`, `SalesStockReconciliation`, `SalesStockReconciliationLine`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. Tạo phiếu kiểm kê (`POST /sales/stocktakes`): hệ thống chụp số lượng tồn sổ sách tại thời điểm tạo làm mốc đối chiếu.
2. Nhân viên kiểm đếm thực tế tại kệ và cập nhật số lượng đếm được (`PATCH /sales/stocktakes/:id/lines`).
3. Xác nhận phiếu kiểm kê (`POST /sales/stocktakes/:id/confirm`): tự động tính chênh lệch thừa/thiếu và sinh `SalesStockMovement` điều chỉnh khớp thực tế.
4. Ngoài ra, công cụ đối soát hệ thống (`GET /sales/stock/reconcile` -> `POST /sales/stock/reconcile/fix`) kiểm tra và sửa sai lệch giữa tổng `SalesStockBatch` và số dư tổng hợp.

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: Số lượng đếm thực tế từng sản phẩm/lô.
* **Đầu ra (Output)**: Phiếu `SalesStocktake` hoàn tất; sổ sách và kho thực tế khớp 100%.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Chỉ phiếu ở trạng thái nháp mới được sửa line; hỗ trợ hủy (`cancel`) trước khi confirm.

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: Báo cáo tồn kho chuẩn xác (FLOW-061)

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-021](./FLOW-021-nhap-kho-theo-lo-hsd-xuat-dieu-chinh-canh-bao-ton-kho.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-023](./FLOW-023-khoi-tao-landing-page-template-packs-ai-generator-crawl-url-pa.md)
