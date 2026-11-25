# [FLOW-051] Chấm Công Bằng Mã QR Động / Vị Trí GPS (QR Attendance Punch)

> **Tầng nghiệp vụ**: TẦNG 12: QUẢN TRỊ NHÂN SỰ, CA KÍP & CHẤM CÔNG (HRM & ATTENDANCE MANAGEMENT)  
> **Thứ tự thực thi**: 51 / 58  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.

---

## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ

* **Điều kiện tiên quyết**: Đã có Ca làm việc được phân công (FLOW-050).
* **Tác nhân**: Nhân viên khi đến nơi làm việc và khi ra về.
* **Chi tiết luồng**:
  1. Tại quầy lễ tân chi nhánh, máy tính bảng hoặc màn hình hiển thị Mã QR Động (`AttendanceQrToken`). Mã này tự động làm mới mỗi 15-30 giây để chống chụp ảnh gửi cho người khác chấm công hộ.
  2. Nhân viên mở điện thoại, đăng nhập vào AiBeego, mở tính năng Chấm công:
     - Ứng dụng bật camera quét mã QR tại quầy.
     - Hệ thống đồng thời lấy tọa độ GPS của điện thoại, kiểm tra khoảng cách có nằm trong bán kính cho phép của Chi nhánh (ví dụ: trong vòng 50 mét) không.
  3. Ghi nhận lượt chấm công (`AttendancePunch`):
     - Giờ vào (Punch IN): So sánh với giờ bắt đầu ca để xác định đúng giờ hay Đi muộn.
     - Giờ ra (Punch OUT): So sánh với giờ kết thúc ca để xác định đúng giờ hay Về sớm.
* **Đầu ra**: Dữ liệu chấm công khách quan, ngăn chặn triệt để gian lận chấm công.
* **Mở khóa**: FLOW-052.

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)

[⬅️ **Luồng trước**: FLOW-050 - Phân Ca Làm Việc & Lập Lịch Trực (Work Shift Policies & Shift Assignment)](./FLOW-050-phan-ca-lam-viec-lap-lich-truc.md) | [📋 **Mục lục 58 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-052 - Quản Lý Nghỉ Phép, Tăng Ca & Chốt Bảng Công Tháng (Leave, Overtime & Timesheet)](./FLOW-052-quan-ly-nghi-phep-tang-ca-chot-bang-cong-thang.md)
