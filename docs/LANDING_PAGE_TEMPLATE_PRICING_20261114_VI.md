# Giá gốc, giá khuyến mãi và CTA cho tính năng tạo nội dung AI

## Hành vi mới

Trong tab **Thông tin sản phẩm** của “Tạo nội dung cho mẫu bằng AI” đã bổ sung:

- **Giá gốc** và **Giá khuyến mãi**, nhập VNĐ; hỗ trợ `10000000`, `10.000.000`, `10,000,000` và định dạng phân nhóm bằng khoảng trắng.
- Xem ngay giá đã định dạng và phần trăm giảm được tính chính xác từ hai mức giá. Ví dụ 10.000.000 → 4.000.000 tương ứng giảm 60%.
- **Box báo giá nhận giá sản phẩm**: chọn đúng box thay vì gán một mức giá cho toàn bộ các gói của mẫu.
- **Thời gian kết thúc ưu đãi** tùy chọn, chọn bằng lịch/ngày giờ trên trình duyệt.

Giá gốc được gạch ngang, giá bán hiển thị lớn và có nhãn giảm giá. Các renderer Pricing mặc định, agency, website, industry và section library đều dùng cùng thành phần so sánh giá.

## Ánh xạ và bảo vệ dữ liệu

1. Giá, phần trăm giảm và lời kêu gọi ưu đãi được tạo bằng code từ dữ liệu người dùng; AI không được tự sửa các giá hoặc phần trăm này.
2. Box được chọn nhận giá, tên sản phẩm và các đặc điểm ngắn từ mô tả. Nội dung mẫu không phù hợp trong đơn vị giá/đặc điểm thừa được đề xuất xóa; các box khác được đề xuất ẩn sau khi duyệt.
3. Giá gốc và giá bán là một nhóm áp dụng: không cho commit riêng một nửa nhóm để tạo cặp giá sai. Nếu một trường giá đang khóa, cần mở khóa trước khi cập nhật.
4. Nội dung người dùng chỉnh thủ công vẫn cần xác nhận thay thế. Khi xác nhận giá, cả hai mức giá được duyệt cùng nhau.
5. Các khối Pricing/Countdown đã ẩn có thể được đề xuất hiển thị lại khi nhập giá. Không tự bật khối mà người dùng đã vô hiệu hóa hoặc khóa.
6. Giá được giữ qua sanitize/autosave/reload của spec. Khi bỏ khuyến mãi, giá gốc gạch ngang được xóa để không giữ lại một mức giảm cũ.

## Bộ đếm giờ và CTA

- Có hạn kết thúc hợp lệ trong tương lai: đưa giá vào khu vực đồng hồ và chạy đếm ngược đến mốc đó.
- Không nhập thời gian: khu vực này chỉ hiển thị ưu đãi và nút đăng ký; không chạy đồng hồ theo mốc mẫu.
- Ví dụ tiêu đề: **Đăng ký ngay hôm nay — giảm 60%**.
- Ví dụ nút: **Đăng ký ngay — giảm 60%**. Giữ đúng hành động gọi điện/email khi CTA vốn có đích tương ứng.
- Nút cạnh giá đưa người xem đến form; trong preview của trình dựng không gửi biểu mẫu.
- Đã sửa lỗi đồng hồ dùng `Date.now()` ngay trong lần render đầu, gây lệch HTML giữa server và browser. Đồng hồ bắt đầu cập nhật sau hydration.

## Kiểm tra giá đầu vào

Từ chối số âm, giá bằng 0, số không an toàn, ký hiệu khoa học, chuỗi HTML, định dạng mơ hồ và giá khuyến mãi lớn hơn hoặc bằng giá gốc. Có giá khuyến mãi thì phải có giá gốc. Hạn kết thúc được nhập phải ở tương lai.

Chỉ hỗ trợ VNĐ nguyên trong hai trường giá mới. Phần trăm được tính bằng số nguyên chính xác rồi lấy tối đa hai chữ số thập phân; không làm tròn một mức giảm gần 100% thành miễn phí. Các trường giá dạng văn bản cũ tiếp tục được hỗ trợ trong luồng cũ.

## Kiểm thử

- 11 kiểm tra mới tại `scripts/test-landing-page-template-pricing.ts`: định dạng, ví dụ giảm 60%, dữ liệu sai, đúng ID box sau đổi thứ tự, đồng hồ/ưu đãi, lưu lại, cập nhật nguyên cặp giá, bỏ giảm giá, chống AI thay giá, hiển thị khối đã ẩn và bảo vệ trường khóa.
- Các bộ hồi quy đã qua: template content 38; content v2 24; SEO editorial 7; URL upgrade 8; URL/SSRF 11; service upgrade 9; compiled service 25.
- Browser QA với component/dialog/renderer thật và transport giả lập: 10 kiểm tra, một lần tạo đề xuất, không gọi publish; nhập giá → chọn box thứ hai → xem trước → duyệt → áp dụng thành công.
- Desktop 1440, tablet 768, mobile 390 px: không tràn ngang. Đã kiểm tra trực quan gạch ngang, mức giá mới và badge giảm 60%.
- Tổng **143 kiểm tra đạt**. Provider/database được mock hoặc không sử dụng; không ghi vào bản nháp thật và không gọi AI tính phí trong lượt QA.
- Shared và API đã build; web production build được kiểm tra riêng. Kiểm tra TypeScript 10 file mục tiêu không có lỗi; còn 23 diagnostic ở các dependency ngoài phạm vi đã được ghi nhận từ lượt rà soát trước. Next build hiện bỏ qua full lint/typecheck theo cấu hình dự án.

Ảnh và kết quả QA nằm tại `.tmp/pricing-qa/`: `price-fields-desktop.png`, `price-box.png`, `offer-1440.png`, `offer-768.png`, `offer-390.png`, `browser-results.json`. Trang `/lp-pricing-qa` chỉ được tạo trong container QA, không nằm trong source ứng dụng bàn giao.

Không thêm migration hay biến môi trường bắt buộc. Sau phản hồi chưa thấy trường giá, đã build và cập nhật hai container local `marketingspa-api` / `marketingspa-web` bằng đúng cấu hình Compose hiện có; reload Nginx. Không triển khai production, không thay database, Redis hay worker.

Đã xác nhận HTML tại `http://localhost:8080` trả HTTP 200; JavaScript đang phục vụ có đủ “Giá gốc”, “Giá khuyến mãi” và “Box báo giá nhận giá sản phẩm”. API đang chạy tính được mức giảm 60% và giá bán 4.000.000 ₫ từ hai giá trong ví dụ. Image trước cập nhật được giữ với tag `before-pricing-20261114` để có thể quay lại. Kết quả xác minh nằm trong `.tmp/pricing-deploy/`.

Để thấy giao diện mới, tải lại bằng Ctrl+F5, mở lại “Tạo nội dung cho mẫu bằng AI”. Nhóm giá nằm ngay dưới “Khách hàng mục tiêu”, trước “Mục tiêu trang”, trong cả chế độ nhập thủ công và lấy nội dung từ URL.
