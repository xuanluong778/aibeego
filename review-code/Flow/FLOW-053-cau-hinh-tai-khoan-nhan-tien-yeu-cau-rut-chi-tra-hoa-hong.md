# [FLOW-053] Cấu hình Tài khoản Nhận tiền, Yêu cầu Rút & Chi trả Hoa hồng

> **Tầng nghiệp vụ**: TẦNG 13: TIẾP THỊ LIÊN KẾT (AFFILIATE MARKETING)  
> **Thứ tự thực thi**: 53 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-052 (Đối tác có hoa hồng đã được duyệt đạt mức tối thiểu).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Đối tác Affiliate + Kế toán / Admin Affiliate

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **UI Routes**: `/affiliate`, `/admin/affiliate`.
* **API Endpoints**: `POST /affiliate/payout-method`, `POST/GET /affiliate/payouts`, `GET /admin/affiliate/payouts`, `POST /admin/affiliate/payouts/:id/approve|reject|mark-paid`.
* **Models**: `AffiliatePayoutMethod`, `AffiliatePayoutRequest`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. Đối tác khai báo thông tin ngân hàng nhận tiền (`POST /affiliate/payout-method`).
2. Đối tác tạo lệnh rút tiền (`POST /affiliate/payouts`) từ số dư hoa hồng khả dụng.
3. Admin xem danh sách lệnh rút (`admin/affiliate/payouts`), đối chiếu cảnh báo gian lận -> bấm **Duyệt** (`approve`) hoặc **Từ chối** (`reject`).
4. Sau khi kế toán chuyển khoản xong -> bấm **Đánh dấu đã chi** (`mark-paid`) kèm chứng từ tham chiếu.

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: Thông tin ngân hàng, số tiền yêu cầu rút.
* **Đầu ra (Output)**: Lệnh `AffiliatePayoutRequest` hoàn tất, số dư đối tác được quyết toán.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Kiểm tra số dư khả dụng trong transaction tránh rút vượt hạn mức hoặc gửi trùng lệnh.

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: Ghi nhận chi phí hoa hồng vào Tài chính (FLOW-059)

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-052](./FLOW-052-theo-doi-click-referral-tinh-hoa-hong-kiem-duyet-gian-lan.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-054](./FLOW-054-quan-ly-nhan-su-phong-ban-hop-dong-ho-so-cap-tai-khoan-he-thon.md)
