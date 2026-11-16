# Sửa AI làm ẩn đồng hồ đếm ngược — 15/11/2026

## Nguyên nhân

Đồng hồ không bị xóa khỏi tính năng. `LandingPageCountdownLive` chỉ render mặt đồng hồ khi `clockMode !== 'offer'`. Luồng `enforceTemplatePricingOffer` trước đây luôn gán `offer` nếu ô `brief.schedule` để trống, dù block đã có `endsAt` hợp lệ. Thay đổi này gây ra tình trạng giá và CTA vẫn còn nhưng các ô ngày/giờ/phút/giây biến mất.

## Thay đổi

- Có thời gian mới hợp lệ: cập nhật thời gian và bật chế độ timer.
- Để trống thời gian mới và block đã có ngày hợp lệ: giữ nguyên clockMode và endsAt.
- Chế độ offer đã chọn rõ ràng: giữ nguyên; không tự bật lại.
- Chưa có mốc hợp lệ: chỉ hiện ưu đãi, không tạo ngày hết hạn.
- Đồng hồ đã hết hạn: không tự gia hạn hoặc khởi động lại.
- Cập nhật hướng dẫn ở form tạo nội dung AI để phản ánh đúng hành vi giữ nguyên cấu hình.

## Trang thực tế

Đã sao lưu và khôi phục riêng `countdown_mrem2qsu` của trang local `agency-portfolio-cream-editorial-sales` sang `timer`, giữ nguyên mốc `2026-11-16T04:24:00.000Z` (11:24 ngày 16/11/2026 tại Việt Nam). Khối ra mắt Aibeego lạc chủ đề vẫn ẩn. Không thay mức giá, form hay nội dung khác.

Kiểm tra trình duyệt xác nhận đủ bốn ô và số giây giảm từ 15 xuống 05 trong hai lần đọc liên tiếp. Ảnh lưu tại `.tmp/lp-conversion/countdown-restored.jpg`. Bản trước khôi phục ở `countdown-restore-before.json` cùng thư mục; thao tác publish cũng tạo version trong ứng dụng.

Các kiểm thử pricing đã qua 12 ca, bao gồm giữ đồng hồ khi thời gian mới để trống, giữ offer-only, giữ nguyên hạn đã hết và bật timer khi nhập hạn mới. Bộ conversion 8 ca và SEO editorial 7 ca cũng đã qua.

Đã build và cập nhật Web/API local. Kiểm tra trên shared thực tế trong container sau triển khai xác nhận: tạo đề xuất với schedule rỗng rồi áp dụng không đổi mode timer, không đổi deadline và không ẩn khối. Public API trả mode timer; HTML có mặt đồng hồ; health/ready trả 200. Kết quả ở `.tmp/lp-conversion/countdown-ai-verification.json`.
