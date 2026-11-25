# [FLOW-037] Đổi Trả Hàng, Hoàn Tiền & Nhập Lại Kho (Sales Returns & Refunds)

> **Tầng nghiệp vụ**: TẦNG 8: BÁN HÀNG, KHUYẾN MÃI, ĐƠN HÀNG & THANH TOÁN (SALES, COUPONS, ORDERS & PAYMENTS)  
> **Thứ tự thực thi**: 37 / 58  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.

---

## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ

* **Điều kiện tiên quyết**: Đơn hàng đã hoàn tất (FLOW-036) nhưng phát sinh yêu cầu đổi trả trong thời hạn cho phép.
* **Tác nhân**: Khách hàng + Kế toán / Thủ kho.
* **Chi tiết luồng**:
  1. Khách mang hàng bị lỗi/không ưng ý đến yêu cầu trả hàng.
  2. Nhân viên tạo Phiếu yêu cầu trả hàng (`SalesReturn`):
     - Chọn đơn hàng gốc `SalesOrder`.
     - Chọn sản phẩm khách muốn trả, số lượng trả và lý do hoàn trả.
  3. Thủ kho kiểm tra tình trạng hàng:
     - Nếu hàng còn nguyên tem/tái sử dụng được: Bấm "Nhập lại kho". Hệ thống sinh `SalesStockMovement` loại `RETURN`, tăng lại tồn kho.
     - Nếu hàng hỏng, phế phẩm: Bấm "Hủy vào kho phế phẩm", không cộng vào tồn bán được.
  4. Kế toán xử lý hoàn tiền:
     - Tính số tiền hoàn trả (đã trừ khấu hao hoặc tiền coupon nếu có).
     - Lập phiếu chi tiền mặt hoặc chuyển khoản hoàn tiền cho khách.
     - Cập nhật trạng thái `SalesReturn` thành `COMPLETED`.
* **Đầu ra**: Hàng hóa và dòng tiền được cân đối lại chính xác, không bị lệch sổ sách kế toán.

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)

[⬅️ **Luồng trước**: FLOW-036 - Xuất Kho Giao Hàng & Trừ Tồn Kho Tự Động (Fulfillment & Stock Movement)](./FLOW-036-xuat-kho-giao-hang-tru-ton-kho-tu-dong.md) | [📋 **Mục lục 58 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-038 - Sáng Tạo Nội Dung & Lên Lịch Đăng Bài Tự Động (Content Marketing & Auto-Post)](./FLOW-038-sang-tao-noi-dung-len-lich-dang-bai-tu-dong.md)
