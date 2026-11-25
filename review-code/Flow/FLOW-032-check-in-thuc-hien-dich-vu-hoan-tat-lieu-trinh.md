# [FLOW-032] Check-in, Thực Hiện Dịch Vụ & Hoàn Tất Liệu Trình (In-Service & Completion)

> **Tầng nghiệp vụ**: TẦNG 7: ĐẶT LỊCH HẸN & VẬN HÀNH DỊCH VỤ (APPOINTMENTS & SPA OPERATIONS)  
> **Thứ tự thực thi**: 32 / 58  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.

---

## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ

* **Điều kiện tiên quyết**: Khách hàng đến cơ sở đúng lịch hẹn (FLOW-031).
* **Tác nhân**: Lễ tân + Kỹ thuật viên spa.
* **Chi tiết luồng**:
  1. Khách đến chi nhánh: Lễ tân mở màn hình lịch hẹn, bấm nút **"Check-in"** -> Trạng thái `CHECKED_IN`.
  2. Kỹ thuật viên đón khách vào phòng, bấm **"Bắt đầu dịch vụ"** -> Trạng thái `IN_PROGRESS`. Sơ đồ giường hiển thị trạng thái "Đang có khách" để tránh xếp khách khác vào.
  3. Sau khi làm xong liệu trình: Kỹ thuật viên bấm **"Hoàn thành"** -> Trạng thái `COMPLETED`.
  4. Hệ thống tự động chuyển thông tin sang quầy lễ tân để tiến hành thanh toán hoặc ghi nhận thẻ liệu trình.
* **Đầu ra**: Liệu trình hoàn thành, mở khóa quy trình xuất hóa đơn và thanh toán (FLOW-034).

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)

[⬅️ **Luồng trước**: FLOW-031 - Xác Nhận & Tự Động Nhắc Lịch (Confirmation & Automated Reminders)](./FLOW-031-xac-nhan-tu-dong-nhac-lich.md) | [📋 **Mục lục 58 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-033 - Thiết Lập Mã Giảm Giá & Chính Sách Khuyến Mãi (Coupons & Promotions)](./FLOW-033-thiet-lap-ma-giam-gia-chinh-sach-khuyen-mai.md)
