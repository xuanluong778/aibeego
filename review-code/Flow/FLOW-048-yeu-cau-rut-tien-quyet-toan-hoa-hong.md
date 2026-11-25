# [FLOW-048] Yêu Cầu Rút Tiền & Quyết Toán Hoa Hồng (Payout Request & Settlement)

> **Tầng nghiệp vụ**: TẦNG 11: TIẾP THỊ LIÊN KẾT (AFFILIATE MARKETING)  
> **Thứ tự thực thi**: 48 / 58  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.

---

## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ

* **Điều kiện tiên quyết**: Hoa hồng đã chuyển sang trạng thái khả dụng và đạt số dư tối thiểu (ví dụ: 200,000 VND).
* **Tác nhân**: Đối tác Affiliate + Kế toán doanh nghiệp.
* **Chi tiết luồng**:
  1. Đối tác vào `/affiliate/payout`, bấm "Yêu cầu rút tiền" (`AffiliatePayoutRequest`).
  2. Hệ thống kiểm tra cảnh báo gian lận (`AffiliateFraudSignal`): Kiểm tra xem IP người mua có trùng IP đối tác không, kiểm tra đơn hàng có bị hủy/hoàn trả không.
  3. Nếu an toàn: Kế toán bấm "Duyệt chi trả", thực hiện chuyển khoản ngân hàng tới STK của đối tác.
  4. Cập nhật trạng thái phiếu rút thành `COMPLETED`, trừ số dư hoa hồng tích lũy.
* **Đầu ra**: Quyết toán sòng phẳng, thúc đẩy đối tác tiếp tục bán hàng cho doanh nghiệp.

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)

[⬅️ **Luồng trước**: FLOW-047 - Ghi Nhận Lượt Nhấp & Tính Hoa Hồng Đơn Hàng (Click Tracking & Commission)](./FLOW-047-ghi-nhan-luot-nhap-tinh-hoa-hong-don-hang.md) | [📋 **Mục lục 58 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-049 - Quản Lý Hồ Sơ Nhân Sự & Hợp Đồng Lao Động (Employee Lifecycle)](./FLOW-049-quan-ly-ho-so-nhan-su-hop-dong-lao-dong.md)
