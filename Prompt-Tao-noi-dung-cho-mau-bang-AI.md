# Prompt triển khai tính năng Tạo nội dung cho mẫu bằng AI

Bạn là kỹ sư full-stack phụ trách Landing Page Builder của Aibeego. Hãy triển khai tính năng **Tạo nội dung cho mẫu bằng AI** cho người dùng đã chọn một template có sẵn. Người dùng nhập thông tin và ảnh sản phẩm một lần, xem nội dung mới ngay trên mẫu, sau đó chọn phần muốn áp dụng.

Thêm một nút riêng **Tạo nội dung cho mẫu bằng AI** trong Builder, ưu tiên đặt cạnh tên mẫu hoặc thao tác đổi mẫu theo bố cục thực tế. Giữ nguyên luồng **Tạo Landing Page bằng AI** hiện có. Phạm vi bản đầu là một sản phẩm trên một trang, hỗ trợ mục tiêu **Bán hàng** và **Nhận tư vấn**, trên một nhóm mẫu bán sản phẩm đã được kiểm tra. Chọn ít nhất hai mẫu có bố cục khác nhau trong nhóm này để nghiệm thu.

## 1. Đọc mã nguồn trước khi triển khai

- Tìm nơi template được chọn, sao chép vào trang và lưu thông tin nhận diện mẫu. Xác định cách Builder nhận diện khối, phần tử và trường ảnh trên một trang đã được chỉnh sửa.
- Kiểm tra Builder, menu AI, các trường nhập thông tin AI, thư viện ảnh, xem trước desktop/mobile, undo và autosave. Kiểm tra API tạo nội dung và cách dự án quản lý quyền, giới hạn gọi AI và credit nếu có.
- Các điểm bắt đầu gồm `apps/web/src/components/landing-pages/landing-page-builder.tsx`, `apps/web/src/components/landing-pages/landing-page-ai-menu.tsx`, `apps/web/src/components/landing-pages/landing-page-ai-brief-fields.tsx`, `apps/api/src/landing-pages/landing-page-ai.service.ts`, `packages/shared/src/landing-page-types.ts` và `packages/shared/src/landing-page-generator.ts`.
- Tái sử dụng dịch vụ AI, thành phần giao diện và cơ chế lưu hiện có khi phù hợp. Hàm `applyLandingPageAiCopyToSpec` hiện có thể đổi theme và token màu. Dùng thao tác áp dụng riêng cho tính năng này, giới hạn ở các trường nội dung đã duyệt.

## 2. Trải nghiệm trong Builder

1. **Nhập thông tin.** Yêu cầu tên sản phẩm, thương hiệu, mô tả ngắn, khách hàng mục tiêu, mục tiêu trang và ít nhất một ảnh. Cho tải ảnh hoặc chọn từ thư viện hiện có, đồng thời cho người dùng đánh dấu ảnh chính. Điền sẵn dữ liệu thương hiệu từ Hồ sơ doanh nghiệp nếu có và cho phép sửa. Đặt giá, ưu đãi, đặc điểm, chính sách và bằng chứng trong mục **Thông tin bổ sung**.
2. **Tạo bản xem trước.** AI viết cho các vị trí đang có trong template. Hiển thị bản xem trước bằng bộ hiển thị hiện có, với chế độ desktop và mobile. Giữ dữ liệu biểu mẫu khi tạo thất bại để người dùng thử lại.
3. **Duyệt đề xuất.** Cho sửa chữ, đổi ảnh, viết lại một khối, áp dụng từng khối hoặc áp dụng tất cả đề xuất hợp lệ. Đánh dấu đề xuất thiếu dữ liệu, nội dung minh họa còn sót lại và các vị trí đã được người dùng chỉnh thủ công. Để người dùng chọn rõ các vị trí đã chỉnh nếu muốn cập nhật chúng.
4. **Áp dụng vào bản nháp.** Dùng cơ chế cập nhật, undo và autosave của Builder. Một lần áp dụng là một thao tác có thể hoàn tác. Trong lúc xem trước, nếu một vị trí được sửa, xóa hoặc khóa, kiểm tra lại trạng thái khi áp dụng và hiển thị vị trí cần xử lý. Giữ hành động xuất bản trong luồng hiện tại của Builder.

## 3. Cách sinh nội dung và áp dụng

- **Xác định vị trí trên mẫu.** Mỗi vị trí có ID đích ổn định, vai trò biên tập và loại nội dung. Với nhóm thẻ, dùng đúng số vị trí hiện có. Với ảnh, kèm vai trò và tỷ lệ khung. Ưu tiên hỗ trợ tiêu đề, mô tả, thẻ lợi ích, ảnh sản phẩm và nhãn nút. Dùng cấu hình theo nhóm mẫu nếu các mẫu chia sẻ cấu trúc. Với mẫu chưa hỗ trợ hoặc trang cũ thiếu thông tin nhận diện, xử lý rõ ràng trong UI và chỉ cho tạo khi xác định được đích an toàn.
- **Tạo đề xuất có cấu trúc.** Gửi thông tin sản phẩm, mục tiêu trang, vị trí đang có và danh sách ảnh hợp lệ. Kết quả cho từng vị trí gồm ID vị trí, nội dung chữ hoặc ID ảnh và trạng thái cần bổ sung khi thiếu dữ liệu. Dùng dữ liệu đầu vào như dữ liệu nghiệp vụ. Duy trì một lợi ích chính xuyên suốt trang, tránh lặp lợi ích giữa các thẻ và viết nhãn nút ngắn, phù hợp với hành động đã cấu hình.
- **Kiểm tra ở API và Builder.** Kiểm tra schema, vị trí được phép sửa, loại dữ liệu, độ dài theo vị trí và quyền truy cập trang, ảnh trong tổ chức. Giá, phần trăm giảm, thông số, bảo hành, chứng nhận, đánh giá và cam kết chỉ lấy từ dữ liệu người dùng đã xác nhận. Với vị trí thiếu dữ liệu, để người dùng bổ sung hoặc bỏ qua đề xuất. Dùng ID ảnh đã chọn và cơ chế quản lý ảnh hiện có. Hiển thị lỗi theo vị trí nếu đề xuất không thể áp dụng.
- **Áp dụng theo danh sách được duyệt.** Lấy trạng thái Builder mới nhất và chỉ cập nhật trường chữ hoặc ảnh tương ứng với vị trí hợp lệ. Giữ ID, số lượng và thứ tự phần tử, layout, theme, token màu, font, kích thước, hiệu ứng, biểu mẫu, tracking và đích nút. Nếu mục tiêu được chọn mâu thuẫn với đích nút đang dùng, yêu cầu người dùng xác nhận hoặc sửa trong Builder trước khi áp dụng nhãn mới. Tạo bản xem trước bằng bản sao trạng thái hiện tại và dùng cùng quy tắc cập nhật để kết quả khớp với lúc áp dụng.

## 4. Tiêu chí nghiệm thu

1. Cùng thông tin sản phẩm và ảnh có thể tạo đề xuất phù hợp trên hai mẫu đã chọn, theo đúng cấu trúc và số vị trí của từng mẫu.
2. Luồng xem trước hiển thị chữ và ảnh trong đúng khung trên desktop và mobile. Việc mở hoặc hủy xem trước giữ trạng thái trang hiện tại.
3. Áp dụng một khối chỉ sửa nội dung được duyệt của khối đó. Áp dụng toàn bộ giữ thiết kế và cấu hình của mẫu. Undo khôi phục nội dung trước lần áp dụng. Tải lại trang sau autosave cho thấy nội dung đã lưu.
4. Với mẫu có ba thẻ lợi ích và dữ liệu chỉ đủ cho hai thẻ, bản xem trước đánh dấu vị trí còn lại **Cần bổ sung**. Giá, chứng thực hoặc thông số minh họa còn trên mẫu được báo rõ trong bước duyệt.
5. Vị trí đã sửa thủ công, bị khóa, đã xóa hoặc thay đổi trong lúc xem trước được xử lý đúng. Ảnh không thuộc phạm vi truy cập không được áp dụng. Khi AI hoặc tải ảnh gặp lỗi, người dùng vẫn giữ được phần thông tin đã nhập để thử lại.
6. Luồng **Tạo Landing Page bằng AI** hiện có và tính năng chỉnh sửa thường trong Builder tiếp tục hoạt động.

Triển khai trong repo, chạy các kiểm tra phù hợp và kiểm thử luồng trên hai mẫu. Khi hoàn tất, báo cáo các mẫu đã hỗ trợ, phần mã đã thay đổi, kết quả kiểm tra và mục còn chưa xác minh.
