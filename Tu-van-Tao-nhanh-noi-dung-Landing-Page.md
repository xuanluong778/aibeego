# Tư vấn tính năng Tạo nội dung cho mẫu bằng AI

Người dùng chọn một template có sẵn, cung cấp thông tin và ảnh sản phẩm, rồi dùng AI để thay nội dung mẫu ngay trên thiết kế đã chọn. Điểm vào đề xuất là nút **Tạo nội dung cho mẫu bằng AI** ở thanh công cụ Builder, cạnh tên mẫu hoặc thao tác đổi mẫu. Nút này phục vụ riêng việc cá nhân hóa template.

## 1. Luồng sử dụng

1. **Chọn mẫu.** Người dùng mở một template trong Builder và bấm **Tạo nội dung cho mẫu bằng AI**.
2. **Nhập thông tin một lần.** Điền tên sản phẩm, thương hiệu, mô tả ngắn, khách hàng mục tiêu và mục tiêu trang. Tải ảnh hoặc chọn từ thư viện và đánh dấu một ảnh chính. Điền sẵn thông tin thương hiệu từ Hồ sơ doanh nghiệp khi có. Giá, ưu đãi, chính sách và đánh giá thật nằm trong mục **Thông tin bổ sung**.
3. **Xem trước trên mẫu.** AI đề xuất chữ và ảnh cho các vị trí có sẵn. Người dùng xem trên desktop và mobile, sửa trực tiếp, viết lại một khối hoặc chọn ảnh khác.
4. **Áp dụng vào bản nháp.** Áp dụng tất cả đề xuất đủ dữ liệu hoặc chọn từng khối. Cho hoàn tác cả lần áp dụng. Nếu một vị trí đã được chỉnh thủ công, đánh dấu rõ và để người dùng chủ động chọn khi muốn cập nhật vị trí đó.

## 2. AI viết theo vị trí và mục tiêu của mẫu

Mỗi vị trí cần có vai trò biên tập và giới hạn phù hợp với thiết kế. Tiêu đề đầu trang tập trung vào lợi ích chính. Các thẻ lợi ích nói về các điểm khác nhau. Nút hành động dùng từ phù hợp với mục tiêu bán hàng hoặc tư vấn và vừa vùng hiển thị. Mỗi vị trí ảnh dùng ảnh do người dùng cung cấp hoặc chọn. Người dùng có thể rà lại vùng cắt ảnh trước khi áp dụng.

Ví dụ, mẫu bán hàng có một ảnh đầu trang và ba thẻ lợi ích. Với bình 500 ml có nắp khóa, AI đề xuất tiêu đề **“Mang đồ uống đi làm gọn hơn”**, dùng ảnh chính ở đầu trang và soạn các thẻ từ đặc điểm người dùng đã cung cấp. Nếu dữ liệu chỉ đủ cho hai lợi ích, Builder đánh dấu vị trí còn lại **Cần bổ sung** trong bản xem trước. Giá, khả năng giữ nhiệt, chống rò rỉ, chứng nhận và lời đánh giá cần có dữ liệu được người dùng xác nhận. Các giá trị minh họa còn sót lại, như giá mẫu hay chứng thực mẫu, cần được đánh dấu rõ để người dùng rà soát trước khi xuất bản.

## 3. Hướng triển khai trong Builder hiện tại

- **Khai báo vị trí được thay nội dung.** Dùng ID khối và ID phần tử hoặc đường dẫn tới trường trong template. Mỗi vị trí khai báo vai trò, loại nội dung và số mục. Với ảnh, lưu thêm tỷ lệ khung. Bắt đầu với đầu trang, lợi ích, ảnh sản phẩm và nhãn nút. Các vị trí này có thể được khai báo theo nhóm cấu trúc template để tái sử dụng.
- **Sinh nội dung theo cấu trúc của mẫu đã chọn.** Gửi thông tin sản phẩm cùng danh sách vị trí cho AI. Kết quả gồm ID vị trí, chữ hoặc ID ảnh đã tải, và trạng thái thiếu dữ liệu nếu có. Builder kiểm tra vị trí hợp lệ, quyền sở hữu ảnh, độ dài gợi ý và dữ liệu cho các tuyên bố. Duy trì số lượng thẻ theo template, kể cả khi có vị trí đang chờ bổ sung.
- **Dùng chung hạ tầng AI và áp dụng có giới hạn.** Hàm tạo nội dung hiện tại có nhánh điền khối sẵn nhưng cũng có thể đổi theme và token màu khi theme chưa khóa. Với luồng theo template, chỉ ghi các trường chữ và ảnh đã duyệt. Kiểm tra lại trên desktop và mobile, đồng thời giữ bố cục, màu, font, hiệu ứng, biểu mẫu và cấu hình đích của các nút. Nếu cần đổi đích CTA, người dùng xác nhận riêng. [Hàm áp dụng AI hiện tại](packages/shared/src/landing-page-generator.ts#L205) · [Cấu trúc template](packages/shared/src/landing-page-types.ts#L587)
- **Xem trước bằng bản sao của trang đang chỉnh.** Dùng bộ hiển thị hiện có để người dùng thấy nội dung mới đúng trên mẫu. Khi áp dụng, kiểm tra vị trí vừa được chỉnh trong lúc đang xem bản nháp và giữ các chỉnh sửa ấy cho đến khi người dùng xác nhận.

## 4. Phạm vi bản đầu

Chọn một nhóm mẫu **bán sản phẩm** có cấu trúc tương đồng. Hỗ trợ thay tiêu đề, mô tả ngắn, lợi ích, ảnh sản phẩm và nhãn nút. Mở rộng sang các nhóm mẫu khác sau khi kiểm tra được ba việc.

1. Cùng một bộ thông tin sản phẩm có thể điền hợp lý vào ít nhất hai template có bố cục khác nhau.
2. Áp dụng và hoàn tác cho kết quả đúng, kể cả khi người dùng chỉ chọn một khối.
3. Trang xem trước hiển thị tốt trên mobile, giữ thiết kế của mẫu và chỉ rõ vị trí thiếu dữ liệu hoặc còn nội dung minh họa.
