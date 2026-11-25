# [FLOW-047] Ghi Nhận Lượt Nhấp & Tính Hoa Hồng Đơn Hàng (Click Tracking & Commission)

> **Tầng nghiệp vụ**: TẦNG 11: TIẾP THỊ LIÊN KẾT (AFFILIATE MARKETING)  
> **Thứ tự thực thi**: 47 / 58  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.

---

## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ

* **Điều kiện tiên quyết**: Đối tác đã có Ref Link (FLOW-046).
* **Tác nhân**: Người mua hàng truy cập qua Ref Link.
* **Chi tiết luồng**:
  1. Người mua nhấp vào liên kết `ref=KOC_MAI`:
     - Hệ thống ghi nhận lượt nhấp (`AffiliateClick`).
     - Lưu cookie theo dõi vào trình duyệt người mua (thời hạn 30-60 ngày theo chính sách doanh nghiệp).
  2. Người mua tiến hành đặt hàng và thanh toán thành công (FLOW-035).
  3. Hệ thống đối soát đơn hàng:
     - Đơn hàng có gắn mã giới thiệu của `KOC_MAI`.
     - Tính toán tỷ lệ hoa hồng (ví dụ: 10% giá trị đơn hàng 1,000,000 VND = 100,000 VND hoa hồng).
     - Tạo bản ghi hoa hồng (`AffiliateCommission`) ở trạng thái `PENDING` (Chờ duyệt sau thời hạn đổi trả hàng 7 ngày).
* **Đầu ra**: Hoa hồng được ghi nhận minh bạch trên bảng điều khiển của đối tác.
* **Mở khóa**: FLOW-048.

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)

[⬅️ **Luồng trước**: FLOW-046 - Đăng Ký Đối Tác Tiếp Thị & Cấp Link Giới Thiệu (Affiliate Onboarding)](./FLOW-046-dang-ky-doi-tac-tiep-thi-cap-link-gioi-thieu.md) | [📋 **Mục lục 58 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-048 - Yêu Cầu Rút Tiền & Quyết Toán Hoa Hồng (Payout Request & Settlement)](./FLOW-048-yeu-cau-rut-tien-quyet-toan-hoa-hong.md)
