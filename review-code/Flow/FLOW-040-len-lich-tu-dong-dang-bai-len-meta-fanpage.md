# [FLOW-040] Lên lịch & Tự động Đăng bài lên Meta Fanpage (`Auto-Post`)

> **Tầng nghiệp vụ**: TẦNG 9: SÁNG TẠO NỘI DUNG, TELEPROMPTER & TỰ ĐỘNG ĐĂNG BÀI  
> **Thứ tự thực thi**: 40 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-013 (Đã kết nối Meta Fanpage `AutoPostFacebookPage`) & FLOW-038/039 (Có nội dung/video).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Social Marketer / BullMQ Scheduler Worker

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **UI Routes**: `/auto-post`.
* **API Endpoints**: `POST /auto-post/ai/generate|rewrite`, `POST /auto-post/drafts`, `PUT /auto-post/posts/:id`, `POST /auto-post/publish`, `POST /auto-post/schedule`, `POST /auto-post/schedule/:id/cancel`, `POST /auto-post/posts/:id/retry`, `GET /auto-post/facebook/meta-metrics`.
* **Models**: `AutoPost`, `AutoPostPublishLog`, `AutoPostApiLog`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. Tạo bài nháp (`POST /auto-post/drafts`) kèm ảnh/video và chọn danh sách các Fanpage đích.
2. Chọn **Đăng ngay** (`POST /auto-post/publish`) hoặc **Hẹn giờ đăng** (`POST /auto-post/schedule` kèm thời điểm `scheduledAt`).
3. Worker theo lịch gọi Meta Graph API để xuất bản bài viết, lưu chi tiết kết quả vào `AutoPostPublishLog` & `AutoPostApiLog`.
4. Nếu đăng lỗi do mạng/token: dùng `POST /auto-post/posts/:id/retry`; theo dõi tương tác thực tế qua `GET /auto-post/facebook/meta-metrics`.

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: Nội dung, media, danh sách `fanpageIds`, lịch đăng.
* **Đầu ra (Output)**: Bài viết đã xuất bản trên Fanpage kèm log và chỉ số tương tác.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Kiểm tra quyền Fanpage còn hiệu lực trước khi publish; hỗ trợ hủy lịch trước giờ đăng (`schedule/:id/cancel`).

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: FLOW-041 (Chuyển bài tương tác tốt thành bài chạy Ads)

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-039](./FLOW-039-quay-video-voi-teleprompter-boc-bang-giong-noi-ai.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-041](./FLOW-041-quan-ly-quang-cao-ai.md)
