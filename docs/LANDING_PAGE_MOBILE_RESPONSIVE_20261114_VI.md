# Tối ưu responsive landing page trên mobile

## Vấn đề và thay đổi

- Đồng hồ cơ bản bị quy tắc .grid của trang ép thành một cột. Chuyển sang grid riêng với số cột theo số đơn vị đang bật; không thay đổi lưới nội dung của các mẫu.
- Giá khuyến mãi dùng vw của cửa sổ desktop trong khung mobile, dẫn đến tách số tiền. Giá nay dùng cqi của vùng chứa và giữ nguyên chuỗi tiền trên một dòng.
- 10 giao diện đồng hồ launch có đơn vị rộng cố định; bổ sung container query để co đều theo chiều rộng thực tế, gồm cả các kiểu vòng tròn, LED, flip, ribbon. Giữ màu và nhận diện của từng giao diện.
- Bổ sung lề countdown launch, cỡ tiêu đề theo container và xếp dọc form khi vùng chứa hẹp.
- Gỡ quy tắc mobile padding-inline:0!important đang ghi đè lề của toàn bộ form native. Form dạng card có lề trong 16px; form plain giữ nguyên.
- Cặp registration cũ giảm khoảng cách trên/dưới xuống 24px khi xếp dọc, thay cho clamp phụ thuộc cửa sổ desktop.
- Ô nhập mobile có chữ tối thiểu 16px và chiều cao tối thiểu 44px, tránh iOS phóng to khi focus; nút CTA chính có vùng chạm tối thiểu 44px.
- Trang public dùng toàn bộ chiều rộng thiết bị, bỏ giới hạn 390/768px vốn dành cho khung preview. Đồng bộ breakpoint mobile public ở 768px.

## Kiểm chứng

- Renderer React thật trong Next container riêng; không dùng HTML rút gọn hoặc ghi vào dữ liệu khách hàng.
- 200 mẫu thuộc 20 nhóm ngành x 4 chế độ: public 320,375,430px và preview mobile 390px trong cửa sổ desktop 1440px.
- Bổ sung bản nháp thực tế và 13 kiểu đồng hồ ở cùng các kích thước: tổng 856 trường hợp, 0 lỗi đo được.
- 102 trường hợp bổ sung: 20 mẫu đại diện ngành, bản nháp và 13 kiểu đồng hồ tại 667px ngang, 844px tablet, 1440px desktop: 0 lỗi đo được.
- Kiểm tra biên của chữ/nút/ô nhập, scrollWidth, số hàng đồng hồ, số dòng giá, lề form, cỡ chữ ô nhập và chiều rộng public. 0 lỗi runtime JavaScript.
- Trình chỉnh sửa thật với API giả lập: mở đúng bố cục bản nháp mới nhất, chuyển Mobile và kiểm tra bốn ô đồng hồ cùng hàng. Không publish hay ghi vào bản nháp thật.
- TypeScript 12 tệp liên quan: 0 lỗi; 23 chẩn đoán dependency ngoài phạm vi đã có từ trước.

## Chạy lại

Dùng scripts/fixtures/landing-page-mobile-audit.tsx làm trang /lp-mobile-audit-qa trong một Next instance thử nghiệm riêng, rồi chạy scripts/qa-landing-page-mobile-templates.cjs. Có thể đặt LP_MOBILE_QA_URL, LP_PLAYWRIGHT_MODULE và LP_CHROME_PATH. Fixture tổng quát không chứa dữ liệu khách hàng. Không đưa route QA vào production.

Kết quả đo và ảnh đối chiếu lưu ở .tmp/mobile-audit; thư mục này bị loại khỏi Docker build context.

## Phạm vi

Đây là kiểm tra tự động trên Chrome với renderer thực, kèm xem ảnh mobile. Chưa kiểm tra trực tiếp trên iPhone/Safari vật lý. Các trang HTML nhập từ bên ngoài có CSS riêng cần kiểm tra riêng; việc sửa tập trung vào toàn bộ 200 system templates và các block native dùng chung.

Kiểm tra bổ sung sau khi sửa selector cho lớp bọc kéo thả: 42 trường hợp của bản nháp/đồng hồ đạt; editor xác nhận padding section 24px và padding form 16px.

## Đã triển khai local

Đã build production, cập nhật container web và nạp lại nginx trên http://localhost:8080. Bundle thực tế có clock grid/unit, giá theo cqi và form surface; health/ready đều HTTP 200. Playwright chạy lại trên bản production, xác nhận cả editor và Xem trước mobile, đồng hồ 4 ô cùng hàng, padding section 24px, lề form 16px, không lỗi JavaScript.
