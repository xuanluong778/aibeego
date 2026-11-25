# [FLOW-046] Đăng Ký Đối Tác Tiếp Thị & Cấp Link Giới Thiệu (Affiliate Onboarding)

> **Tầng nghiệp vụ**: TẦNG 11: TIẾP THỊ LIÊN KẾT (AFFILIATE MARKETING)  
> **Thứ tự thực thi**: 46 / 58  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.

---

## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ

* **Điều kiện tiên quyết**: Đã có Tổ chức (FLOW-007) và Sản phẩm/Dịch vụ (FLOW-016, FLOW-017).
* **Tác nhân**: Khách hàng cũ / Đối tác / KOL / KOC muốn làm cộng tác viên.
* **Chi tiết luồng**:
  1. Đối tác truy cập cổng đăng ký `/affiliate/register`.
  2. Điền thông tin cá nhân, kênh quảng bá (TikTok, Facebook, Blog) và Tài khoản ngân hàng nhận tiền.
  3. Quản trị viên duyệt hồ sơ đối tác (`AffiliateProfile` chuyển sang `ACTIVE`).
  4. Hệ thống cấp cho đối tác:
     - Một Mã giới thiệu độc quyền (Affiliate Code).
     - Một Liên kết giới thiệu có gắn mã theo dõi (Ref Link): `https://aibeego.com/p/tri-mun?ref=KOC_MAI`.
* **Đầu ra**: Đối tác có công cụ để bắt đầu chia sẻ link bán hàng.
* **Mở khóa**: FLOW-047.

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)

[⬅️ **Luồng trước**: FLOW-045 - Tự Động Trả Lời CSKH & Bàn Giao Tư Vấn Viên (AI Auto-Reply & Human Handoff)](./FLOW-045-tu-dong-tra-loi-cskh-ban-giao-tu-van-vien.md) | [📋 **Mục lục 58 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-047 - Ghi Nhận Lượt Nhấp & Tính Hoa Hồng Đơn Hàng (Click Tracking & Commission)](./FLOW-047-ghi-nhan-luot-nhap-tinh-hoa-hong-don-hang.md)
