# Prompt nâng cấp tiếp tính năng URL cho SaaS

```text
Đọc docs/LANDING_PAGE_URL_SAAS_AUDIT_20261114_VI.md và source hiện tại, rồi hoàn thiện “Tạo nội dung từ URL” để vận hành SaaS. Tái sử dụng kiến trúc hiện có và giữ các thay đổi đang có; không chỉ đề xuất giải pháp.

Ưu tiên triển khai:
1. Thêm feature credit riêng, giá cấu hình qua admin, quota theo gói và tenant. Dùng ledger reserve/commit/release hiện có, chống trừ trùng khi retry; phân biệt lỗi trước khi gọi provider với lượt đã phát sinh chi phí. Không tự đặt giá bán trong code.
2. Đưa tạo nội dung vào job bền vững: job ID, tiến độ, retry hữu hạn, timeout, lưu kết quả và mở lại sau reload. Chia sẻ trạng thái qua Redis/database, kiểm tra quyền tenant/user/page tại mọi endpoint.
3. Giữ đầy đủ kiểm chứng nội dung: dữ kiện có nguồn, schema đúng mẫu, tiêu đề theo ngành, không bịa số liệu/giá/lịch/đánh giá/cam kết. Thẻ thiếu dữ liệu phải được bổ sung hoặc duyệt ẩn; không lấp bằng nội dung lặp hay để sót dữ liệu mẫu.
4. Cho người dùng duyệt hồ sơ trích xuất và dữ liệu mâu thuẫn trước khi tạo; xem trước đúng kết quả sẽ áp dụng, bảo vệ field đã chỉnh, hỗ trợ hoàn tác; chỉ lưu bản nháp.
5. Ghi metric và usage theo job/tenant, gồm thời gian, số lô, token/chi phí nếu có, tỷ lệ fallback và lỗi. Không log khóa, HTML nguyên văn hoặc dữ liệu cá nhân.
6. Giữ bảo vệ SSRF/DNS/redirect, giới hạn dung lượng, chống prompt injection và kiểm tra media. Mở rộng theo ngành bằng schema và fixture thực tế, không hard-code một website.

Kiểm thử bắt buộc: credit thiếu/đủ/hoàn/trừ trùng; hai API và Redis thật; restart/reload/retry; URL lỗi/SSRF; AI sai schema/bịa dữ kiện; áp dụng từng phần/ẩn thẻ/khóa field; browser E2E và mobile; autosave/reload không đổi thiết kế và không gọi publish. Chạy các bộ hồi quy hiện có, xử lý gate TypeScript/lint thay vì chỉ dựa vào Next build đang bỏ qua lỗi.

Triển khai theo P0 rồi P1 trong báo cáo. Báo cáo phần hoàn thành, bằng chứng kiểm thử và giới hạn còn lại; không tự triển khai production.
```
