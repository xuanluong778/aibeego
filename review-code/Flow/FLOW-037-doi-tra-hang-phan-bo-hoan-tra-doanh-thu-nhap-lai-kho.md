# [FLOW-037] Đổi Trả Hàng, Phân bổ Hoàn trả Doanh thu (`AllocationSnapshot`) & Nhập lại Kho

> **Tầng nghiệp vụ**: TẦNG 8: BÁN HÀNG, ĐƠN HÀNG, THANH TOÁN & ĐỔI TRẢ  
> **Thứ tự thực thi**: 37 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-036 (Đơn hàng đã xuất kho / hoàn tất).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Nhân viên CSKH / Thủ kho / Kế toán

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **UI Routes**: `/sales/orders`.
* **API Endpoints**: `POST /sales/returns/preview`, `POST /sales/returns`, `GET /sales/returns`, `GET /sales/returns/:id`.
* **Models**: `SalesReturn`, `SalesReturnItem`, `SalesStockMovement`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. Nhân viên chọn đơn hàng phát sinh trả hàng và danh sách sản phẩm/số lượng trả -> gọi `POST /sales/returns/preview`.
2. Hệ thống tính toán `allocationSnapshot` (tách riêng phần doanh thu đảo, phân bổ chiết khấu đơn/dòng, phí ship và số tiền đề xuất hoàn `refundAmount`).
3. Xác nhận tạo phiếu trả (`POST /sales/returns`): sinh `SalesReturn` & `SalesReturnItem`, cộng lại số lượng tồn kho (nếu hàng đạt chuẩn nhập lại kho) qua `SalesStockMovement` (loại `RETURN`).
4. Cập nhật trạng thái đơn gốc (`RETURNED` nếu trả toàn bộ) và chốt số liệu hoàn tiền.

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: Đơn hàng gốc, sản phẩm trả, số lượng, lý do trả.
* **Đầu ra (Output)**: Phiếu `SalesReturn` kèm `allocationSnapshot` minh bạch và phiếu nhập lại kho.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Không cho trả vượt quá số lượng đã mua trừ số lượng đã trả các lần trước; tách rõ hoàn tiền vs điều chỉnh doanh thu.

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: Báo cáo doanh thu thuần & tồn kho chuẩn xác (FLOW-061)

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-036](./FLOW-036-xac-nhan-trang-thai-xuat-kho-giao-hang-tru-ton-fifo.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-038](./FLOW-038-sang-tao-noi-dung-ai-giong-van-ca-nhan-kiem-duyet-chinh-sach-f.md)
