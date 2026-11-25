# [FLOW-033] Thiết Lập Mã Giảm Giá & Chính Sách Khuyến Mãi (Coupons & Promotions)

> **Tầng nghiệp vụ**: TẦNG 8: BÁN HÀNG, KHUYẾN MÃI, ĐƠN HÀNG & THANH TOÁN (SALES, COUPONS, ORDERS & PAYMENTS)  
> **Thứ tự thực thi**: 33 / 58  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.

---

## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ

* **Điều kiện tiên quyết**: Đã có Sản phẩm (FLOW-016) hoặc Dịch vụ (FLOW-017).
* **Tác nhân**: Quản lý Marketing / Chủ doanh nghiệp.
* **Chi tiết luồng**:
  1. Vào `/sales/coupons`, bấm "Tạo Mã Khuyến Mãi":
     - Mã code (ví dụ: `AIBEEGO50`, `WELCOME2026`).
     - Loại giảm giá: Giảm theo phần trăm (ví dụ: 20%) hoặc Giảm số tiền cố định (ví dụ: 100,000 VND).
     - Giới hạn giảm tối đa (ví dụ: Giảm 20% tối đa 200,000 VND).
     - Giá trị đơn hàng tối thiểu để áp dụng (ví dụ: Đơn từ 500,000 VND trở lên).
     - Tổng số lượt sử dụng tối đa (ví dụ: 100 lượt đầu tiên) và Giới hạn mỗi khách hàng chỉ dùng 1 lần.
     - Thời gian hiệu lực: Từ ngày... đến ngày...
     - Phạm vi áp dụng: Toàn bộ cửa hàng, hoặc chỉ áp dụng cho một số Danh mục/Sản phẩm/Dịch vụ nhất định.
  2. Bấm "Kích hoạt": Mã coupon sẵn sàng để áp dụng khi thanh toán.
* **Đầu ra**: Chính sách mã giảm giá hợp lệ sẵn sàng đưa vào luồng bán hàng.
* **Mở khóa**: FLOW-034.

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)

[⬅️ **Luồng trước**: FLOW-032 - Check-in, Thực Hiện Dịch Vụ & Hoàn Tất Liệu Trình (In-Service & Completion)](./FLOW-032-check-in-thuc-hien-dich-vu-hoan-tat-lieu-trinh.md) | [📋 **Mục lục 58 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-034 - Tạo Đơn Hàng Bán Lẻ & Áp Dụng Mã Giảm Giá (Order Creation with Coupon)](./FLOW-034-tao-don-hang-ban-le-ap-dung-ma-giam-gia.md)
