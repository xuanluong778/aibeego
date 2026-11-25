# [FLOW-008] Cấu hình Chi nhánh & Cơ sở Vận hành (Branches Management)

> **Tầng nghiệp vụ**: TẦNG 2: THIẾT LẬP TỔ CHỨC, GÓI CƯỚC & PHÂN QUYỀN (ORGANIZATION, SUBSCRIPTION & RBAC)  
> **Thứ tự thực thi**: 8 / 58  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Hoàn thành điều kiện tiên quyết trước khi kích hoạt luồng này.

---

## NỘI DUNG CHI TIẾT LUỒNG NGHIỆP VỤ

* **Điều kiện tiên quyết**: Đã có Tổ chức (FLOW-007).
* **Tác nhân**: Chủ doanh nghiệp.
* **Chi tiết luồng**:
  1. Doanh nghiệp có thể có một hoặc nhiều địa điểm kinh doanh (Chi nhánh 1, Chi nhánh 2...).
  2. Người dùng vào `/settings/branches`, bấm Thêm chi nhánh mới (`Branch`):
     - Tên chi nhánh, Địa chỉ cụ thể, Số điện thoại chi nhánh.
     - Định vị tọa độ GPS (phục vụ tính năng chấm công nhân viên và định tuyến khách hàng theo khu vực).
  3. Thiết lập chi nhánh mặc định của tổ chức.
* **Đầu ra**: Danh sách `Branch` được kích hoạt.
* **Mở khóa**: FLOW-017 (Dịch vụ phòng spa), FLOW-020 (Quản lý kho chi nhánh), FLOW-049 (Nhân sự chi nhánh).

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG (NAVIGATION)

[⬅️ **Luồng trước**: FLOW-007 - Khởi tạo & Cấu hình Tổ chức / Doanh nghiệp (Organization Setup)](./FLOW-007-khoi-tao-cau-hinh-to-chuc-doanh-nghiep.md) | [📋 **Mục lục 58 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-009 - Phân quyền & Quản lý Vai trò Đội ngũ (RBAC - Roles & Permissions)](./FLOW-009-phan-quyen-quan-ly-vai-tro-doi-ngu.md)
