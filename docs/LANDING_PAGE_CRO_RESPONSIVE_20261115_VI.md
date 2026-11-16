# Kiểm tra nội dung AI, desktop và mobile — 15/11/2026

## Đánh giá từ ảnh và trang local thực tế

Trang đã đúng chủ đề SEO nhưng chưa đủ thuyết phục để chỉ dựa vào nội dung mà kết luận sẽ tăng chuyển đổi. Vấn đề chính nằm ở sự nhất quán giữa thông điệp, nút bấm và trải nghiệm đăng ký, cùng các lỗi bố cục nhỏ khiến trang thiếu chỉn chu.

| Điểm cần sửa | Ảnh hưởng | Thay đổi |
| --- | --- | --- |
| H2 chạm nhãn phần ở một số vị trí | Khó đọc, giảm độ tin cậy | Xếp nhãn, H2, mô tả thành các hàng riêng; tắt animation của tiêu đề section gây dịch chuyển vào nhãn |
| Một gói học phí còn nằm trong lưới ba cột | Lệch trái, nhiều khoảng trống | Tính số gói đang hiển thị, dùng một cột và căn giữa |
| Hero dùng ảnh cao, crop hình trên mobile | Đẩy nội dung và form xuống sâu | Giới hạn ảnh hero 260px, dùng contain trên mobile |
| Nút “Đăng ký ngay — giảm 50%” ở mọi vị trí | Không khớp với form chỉ nhận tư vấn | CTA khác nhau theo mục đích và vị trí; không biến việc gửi form thành cam kết mua/giữ chỗ |
| “Xem giới thiệu” xuất hiện trên ảnh nhưng không mở video | Gợi hành động không tồn tại | Bỏ nhãn video trang trí |
| Lợi ích kiểu “bứt phá”, “tiết kiệm quảng cáo” | Chung chung hoặc suy diễn vượt nguồn | Nêu công việc cụ thể: từ khóa, nội dung, website, đọc dữ liệu, phản hồi trực tiếp |
| Phần chuẩn bị lặp lại ba ảnh và ba ý đơn giản | Trang mobile dài mà không tăng giá trị | Với trang đang tối ưu, gom vào FAQ và ẩn section lặp; vẫn giữ cấu hình để hoàn tác |
| Nội dung AI nhắc tài liệu miễn phí | Có thể biến tài nguyên trên website thành quyền lợi khóa học chưa xác nhận | Loại dữ kiện quảng bá miễn phí khỏi ngữ cảnh biên tập và chặn câu AI hứa miễn phí |
| CSS tối ưu phụ thuộc fieldSources | Trang public đã lọc metadata này nên không bật CSS | Dùng receipt contentSource của URL để bật typography trên public |

## Nội dung và CTA sau biên tập

- H1: **Học SEO bài bản, thực hành trên website của bạn**.
- Mô tả: nói rõ nghiên cứu từ khóa, tối ưu website, đọc dữ liệu, học theo lộ trình và trao đổi khi vướng.
- Trust points: lộ trình từ nền tảng đến triển khai; thực hành trên website của người học; theo dõi kết quả bằng dữ liệu. Không dùng số học viên, chứng chỉ hoặc kết quả chưa xác nhận.
- Nút Hero: **Nhận tư vấn lộ trình học**.
- Nút khu vực học phí: **Tư vấn học phí và lịch học**.
- Nút trong gói: **Tư vấn trước khi đăng ký**.
- Nút gửi form: **Gửi yêu cầu tư vấn ngay**.
- Microcopy: giải thích gửi tư vấn chưa phải thanh toán.
- Nút cố định trên mobile: dẫn về form, tự ẩn khi form vào màn hình hoặc khi nhập liệu. Không tự gửi form.

Mức giá 5.000.000 ₫ → 2.500.000 ₫ được giữ theo dữ liệu đã nhập. Thay “hôm nay” bằng tiêu đề ưu đãi không gắn hạn thiếu căn cứ. Không thêm hạn chót, số chỗ, quà tặng, SLA phản hồi hoặc bảo đảm thứ hạng.

Gói học phí có ba thông tin cụ thể dựa trên nguồn: thực hành website; theo dõi GA4/Search Console; trao đổi trực tiếp về nội dung học. Ba nhóm giáo trình vẫn bao phủ 10 học phần của nguồn.

## Quan sát đo trước sửa

Kiểm tra trang public trong trình duyệt ở viewport 390 × 844:

- Chiều cao toàn trang khoảng 11.098px.
- Ảnh hero cao khoảng 429px.
- H1 khoảng 27,3px; các ô nhập 16px.
- Không quan sát thấy tràn ngang.
- Có trạng thái animation làm khoảng cách giữa nhãn và H2 thành số âm ở section lợi ích.

Ảnh toàn trang bị thu nhỏ trong hội thoại không đủ để kết luận cỡ chữ nhỏ trên thiết bị thật. Các số đo trên lấy từ DOM và computed style tại viewport thực tế.

## Những dữ liệu còn cần để tăng sức thuyết phục

1. Hồ sơ giảng viên và vai trò trực tiếp trong khóa học, kèm ảnh thật được phép sử dụng.
2. Ví dụ bài tập, kế hoạch SEO hoặc sản phẩm thực hành học viên sẽ làm.
3. Phản hồi học viên thật có sự đồng ý, bối cảnh và nội dung cụ thể.
4. Lịch, thời lượng, hình thức học, điều kiện hỗ trợ và chính sách đã xác nhận.

Các mục thiếu không được AI tự bịa để làm trang có vẻ đáng tin hơn. Ảnh minh họa SEO hiện tại còn lặp và mang tính stock; nên thay bằng tư liệu lớp học, thao tác hoặc sản phẩm thực hành thật khi có.

## Kết quả kiểm tra sau triển khai local

Đã build và khởi động lại Web/API tại localhost:8080. Trang đang xuất bản local đã lưu revision 14. Có sao lưu trước biên tập, trước chỉnh hình học và version trong lịch sử ứng dụng. Không cập nhật VPS bên ngoài máy local.

Kiểm tra DOM thực tế còn tìm thấy tọa độ kéo cũ của tiêu đề lợi ích: x=-52px, y=-18px, kèm chiều cao section tối thiểu 671px. Đã bỏ riêng tọa độ và chiều cao thừa này trên trang đang sửa, giữ nguyên các cấu hình khác. Đây là nguyên nhân trực tiếp của tiêu đề chồng nhãn trong ảnh; không chỉ là vấn đề kích thước font.

| Chiều rộng | Chế độ | Cao trang (px) | Tràn ngang / chữ bị cắt | Khoảng cách nhãn–H2 nhỏ nhất | Lệch tâm thẻ giá |
| ---: | --- | ---: | --- | ---: | ---: |
| 320 | mobile | 9559 | 0 / 0 | 12px | 0px |
| 375 | mobile | 8949 | 0 / 0 | 12px | 0px |
| 390 | mobile | 8936 | 0 / 0 | 12px | 0px |
| 430 | mobile | 8781 | 0 / 0 | 12px | 0px |
| 768 | tablet | 7886 | 0 / 0 | 12px | 0px |
| 1024 | desktop | 6982 | 0 / 0 | 12px | 0px |
| 1440 | desktop | 7282 | 0 / 0 | 12px | 0px |

Ở 390px: cao trang giảm từ khoảng 11098px xuống 8936px (giảm khoảng 19,5%); ảnh hero giảm từ 429px xuống 257px. Ở mọi kích thước đã đo, input có font 16px. H1 thích ứng từ khoảng 25,6px ở 320px đến 52px ở 1440px; giữ những quy tắc responsive và kích thước tùy chỉnh hiện có.

Đã bấm nút CTA mobile: form được đưa đến top=0, thanh CTA tự ẩn khi form hiện trên màn hình. Đã mở FAQ chuẩn bị và xác nhận nội dung đầy đủ hiển thị. Không gửi dữ liệu liên hệ thử nghiệm. Không ghi nhận console error trong phiên kiểm tra. Nút cố định chỉ có trên trang public đủ điều kiện; không thêm vào giao diện builder.

88 ca kiểm tra trong năm bộ content, content-v2, pricing, SEO editorial và conversion đã qua. Kiểm tra cú pháp các component mới/thay đổi không có lỗi. Kiểm tra shared/API thực hiện trong build; Next build của repository đang cấu hình bỏ qua typecheck/lint nên không xem build Web thành bằng chứng đã qua toàn bộ kiểm tra kiểu frontend.

Ảnh đối chiếu lưu tại `.tmp/lp-conversion/cro-desktop-after.jpg`, `.tmp/lp-conversion/cro-mobile-after.jpg`; số đo ở `cro-responsive-browser-results.json` cùng thư mục. Các phép đo là trang public thật. Sửa xếp hàng heading áp dụng chung cho renderer dùng trong builder, nhưng không có kiểm thử đăng nhập và tương tác builder trong lượt này.

## Đo chuyển đổi sau triển khai

Chỉ số chính nên là số yêu cầu hợp lệ trên số phiên truy cập, tách desktop/mobile. Theo dõi tiếp tỷ lệ bấm CTA → bắt đầu form → gửi thành công bằng các sự kiện đang có. Tối ưu số lượt bấm đơn thuần có thể làm tăng lead kém chất lượng.

Có thể thử hai nhãn CTA cùng dẫn về tư vấn: “Nhận tư vấn lộ trình học” và “Tư vấn lộ trình phù hợp với tôi”. Giữ nguồn traffic, offer và bố cục nhất quán khi so sánh. Chưa có dữ liệu thực nghiệm để cam kết phần trăm tăng chuyển đổi.
