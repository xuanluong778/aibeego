# [FLOW-050] Trợ lý Điều hành AI Nội bộ với Tool-Calling & Xác nhận Hành động

> **Tầng nghiệp vụ**: TẦNG 12: CƠ SỞ TRI THỨC RAG, CHATBOT CSKH & TRỢ LÝ AI NỘI BỘ  
> **Thứ tự thực thi**: 50 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-004 (Nhân viên/Quản lý đã đăng nhập) & FLOW-011 (Ví Credit AI).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Quản lý / Nhân viên nội bộ + AI Assistant Orchestrator

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **UI Routes**: `/ai`.
* **API Endpoints**: `GET /assistant/status`, `GET /assistant/tools`, `GET/POST /assistant/sessions`, `GET/DELETE /assistant/sessions/:id`, `POST /assistant/chat`, `POST /assistant/actions/confirm`, `POST /assistant/actions/cancel`.
* **Models**: `AssistantSession`, `AssistantMessage`, `AssistantPendingAction`, `AssistantAuditLog`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. Người dùng mở `/ai`, tạo phiên trò chuyện (`POST /assistant/sessions`) và xem danh sách công cụ trợ lý được phép dùng (`GET /assistant/tools`).
2. Gửi yêu cầu bằng ngôn ngữ tự nhiên (`POST /assistant/chat`): ví dụ *"Kiểm tra doanh thu tuần này"* hoặc *"Tạo công việc mới cho bạn A"*.
3. `assistant.orchestrator.service.ts` phân tích ý định và gọi tool đọc dữ liệu an toàn (`tool-runtime.ts`).
4. Nếu là hành động làm thay đổi dữ liệu (ghi/sửa/xóa): hệ thống tạo `AssistantPendingAction` hiển thị tóm tắt để con người kiểm tra -> Bấm **Xác nhận** (`actions/confirm`) để thực thi hoặc **Hủy** (`actions/cancel`), mọi thao tác lưu `AssistantAuditLog`.

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: Câu lệnh ngôn ngữ tự nhiên, xác nhận hành động từ người dùng.
* **Đầu ra (Output)**: Kết quả phân tích hoặc thao tác nghiệp vụ được thực thi an toàn.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Áp dụng quyền hạn RBAC của chính người dùng đang chat; hành động ghi dữ liệu bắt buộc qua `AssistantPendingAction` confirm.

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: Tăng tốc độ tra cứu và điều hành tác vụ đa module

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-049](./FLOW-049-van-hanh-hop-thu-hop-nhat-tu-dong-tra-loi-rag-ban-giao-tu-van-.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-051](./FLOW-051-dang-ky-doi-tac-affiliate-cau-hinh-hoa-hong-cap-link-gioi-thie.md)
