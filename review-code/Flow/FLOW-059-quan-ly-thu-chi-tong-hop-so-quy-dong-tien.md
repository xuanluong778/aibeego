# [FLOW-059] Quản lý Thu - Chi & Tổng hợp Sổ quỹ Dòng tiền (`Finance`)

> **Tầng nghiệp vụ**: TẦNG 15: TÀI CHÍNH, MỤC TIÊU KINH DOANH & QUẢN TRỊ TOÀN SÀN  
> **Thứ tự thực thi**: 59 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-033/035 (Dòng tiền Thu từ Đơn dịch vụ & Bán lẻ), FLOW-020/053/056 (Chi nhập hàng, Hoa hồng Affiliate, Lương).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Kế toán / Giám đốc tài chính / Chủ doanh nghiệp

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **UI Routes**: `/finance`, `/sales/reports`.
* **API Endpoints**: `GET /finance/dashboard`, `GET/POST /finance/expenses`, `PATCH/DELETE /finance/expenses/:id`, `GET /sales/reports/summary`, `GET /sales/reports/export.csv`.
* **Backend RBAC**: `finance.rbac.ts`.
* **Models**: `Expense`, `Payment`, `SalesPayment`, `SalesReturn`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. Hệ thống tự động tổng hợp doanh thu thực thu từ `Payment` (dịch vụ) và `SalesPayment` (bán lẻ), trừ các khoản hoàn trả (`SalesReturn`).
2. Kế toán ghi nhận các khoản chi phí vận hành (`POST /finance/expenses`: mặt bằng, điện nước, chi phí marketing, lương, mua sắm...).
3. Màn hình `/finance` (`GET /finance/dashboard`) hiển thị bức tranh Thu - Chi, lợi nhuận ròng và xuất báo cáo bán hàng CSV (`sales/reports/export.csv`).

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: Chứng từ thanh toán thu, phiếu chi phí `Expense`.
* **Đầu ra (Output)**: Báo cáo dòng tiền và kết quả kinh doanh theo kỳ.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Kiểm soát chặt chẽ quyền truy cập qua `finance.rbac.ts`.

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: FLOW-060, FLOW-061

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-058](./FLOW-058-thuc-thi-checklist-giao-rieng-theo-hang-muc-log-thoi-gian-duye.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-060](./FLOW-060-thiet-lap-muc-tieu-kinh-doanh-mo-phong-kich-ban-tang-truong.md)
