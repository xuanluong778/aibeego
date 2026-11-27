# [FLOW-019] Quản lý Dịch vụ Spa, Phòng, Giường & Thiết bị (Services & Facilities)

> **Tầng nghiệp vụ**: TẦNG 4: DANH MỤC SẢN PHẨM, DỊCH VỤ SPA & QUẢN TRỊ KHO  
> **Thứ tự thực thi**: 19 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-008 (Đã có Chi nhánh `Branch`).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Quản lý chi nhánh Spa / Thẩm mỹ viện

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **UI Routes**: `/appointments`.
* **API Endpoints**: `GET /appointments/services` (và quản lý CRUD `Service`, `SpaRoom`, `SpaBed`, `SpaEquipment`).
* **Models**: `Service`, `SpaRoom`, `SpaBed`, `SpaEquipment`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. Khai báo danh mục dịch vụ / liệu trình (`Service`): tên dịch vụ, thời lượng thực hiện (phút), đơn giá, mô tả.
2. Khai báo hạ tầng phòng dịch vụ theo từng chi nhánh (`SpaRoom`), danh sách giường trong phòng (`SpaBed`) và máy móc thiết bị chuyên dụng (`SpaEquipment`).
3. Thông tin này là dữ liệu đầu vào bắt buộc để xếp lịch hẹn không bị chồng chéo phòng/giường và tạo Landing Page giới thiệu dịch vụ.

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: Danh sách dịch vụ, thời lượng, giá, danh sách phòng & giường theo chi nhánh.
* **Đầu ra (Output)**: Cấu trúc `Service`, `SpaRoom`, `SpaBed` sẵn sàng đặt lịch.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Liên kết chặt chẽ với `branchId` và `organizationId`.

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: FLOW-023 (Landing Page dịch vụ), FLOW-031 (Đặt lịch hẹn Spa), FLOW-033 (Đơn dịch vụ)

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-018](./FLOW-018-nhap-san-pham-hang-loat-tu-excel-dong-bo-cua-hang-woocommerce.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-020](./FLOW-020-quan-ly-nha-cung-cap-don-dat-mua-hang.md)
