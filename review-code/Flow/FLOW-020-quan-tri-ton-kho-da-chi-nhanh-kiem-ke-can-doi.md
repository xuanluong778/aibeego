# [FLOW-020] Quản trị Tồn kho Đa chi nhánh, Kiểm kê & Cân đối (Stocktake & Reconciliation)

> **Tầng nghiệp vụ**: TẦNG 4: DANH MỤC SẢN PHẨM, DỊCH VỤ & QUẢN TRỊ KHO (CATALOG, SERVICES & INVENTORY)  
> **Thứ tự thực thi**: 20 / 58  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.

---

## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ

* **Điều kiện tiên quyết**: Đã có hàng tồn kho (FLOW-019).
* **Tác nhân**: Thủ kho / Kế toán kiểm kê.
* **Chi tiết luồng**:
  1. Định kỳ cuối tháng/quý, lập Phiếu kiểm kê kho (`SalesStocktake`):
     - Chọn Chi nhánh và Phạm vi kiểm kê (Toàn bộ kho hoặc theo Danh mục).
     - Hệ thống đóng băng số liệu tồn sổ sách tại thời điểm kiểm.
  2. Nhân viên quét mã vạch và đếm số lượng thực tế trên kệ, nhập vào phiếu kiểm kê.
  3. Hệ thống tự động so khớp:
     - Chênh lệch thừa: Thực tế > Sổ sách.
     - Chênh lệch thiếu: Thực tế < Sổ sách (thất thoát, hỏng vỡ).
  4. Quản lý duyệt Phiếu cân đối kho (`SalesStockReconciliation`):
     - Tự động sinh `SalesStockMovement` loại `ADJUSTMENT` để điều chỉnh số tồn sổ sách khớp chuẩn 100% với thực tế.
* **Đầu ra**: Số liệu tồn kho chính xác tuyệt đối, tránh tình trạng đơn hàng bán ra nhưng hết hàng thực tế.

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)

[⬅️ **Luồng trước**: FLOW-019 - Nhập kho, Quản lý Lô & Hạn sử dụng (Inward Stock & Batch Management)](./FLOW-019-nhap-kho-quan-ly-lo-han-su-dung.md) | [📋 **Mục lục 58 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-021 - Thiết kế Landing Page bằng Visual Builder & AI Generator](./FLOW-021-thiet-ke-landing-page-bang-visual-builder-ai-generator.md)
