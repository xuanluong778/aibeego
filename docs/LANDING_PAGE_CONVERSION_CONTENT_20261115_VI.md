# Nâng cấp nội dung AI từ URL — 15/11/2026

## Cập nhật triển khai local và sửa trang thực tế

Sau phản hồi ảnh vẫn như cũ, đã xác định hai nguyên nhân: container Docker chưa nhận mã nguồn mới; tiêu đề mẫu không có fieldSources bị coi là nội dung cần bảo vệ. Đã cho phép thay nhãn mẫu không gắn nguồn người dùng, vẫn giữ bảo vệ khi source là user hoặc nội dung tùy chỉnh không phải nhãn mẫu.

Đã build thành công Web và API bằng Docker, khởi động lại đúng hai service thuộc dự án aibeego và reload Nginx. Không cập nhật các stack khác trên máy.

Đã tạo lại nội dung từ URL thật bằng AI cấu hình hiện có cho trang `2a68892a-e811-4647-a29c-600827b46cc8` (35 ô nhận nội dung AI, phần còn lại dùng bản dự phòng có kiểm chứng). Sao lưu trạng thái trước sửa tại `.tmp/lp-conversion/repair-backup/before.json`, chuẩn bị và kiểm tra trước khi lưu. Đã lưu và cập nhật trang local qua service autosave/publish có kiểm tra revision; revision mới là 9. Có bản version trong lịch sử ứng dụng.

Trang đã sửa: http://localhost:8080/p/agency-portfolio-cream-editorial-sales

HTTP trên bản đang chạy xác nhận:

- Public API và HTML đều trả 200, HTML có H1 mới “Học SEO có lộ trình, biết cách làm trên website”.
- Các tiêu đề hiển thị không còn nhãn sản phẩm chung chung; khối ra mắt Aibeego và chính sách thiếu dữ kiện đã được ẩn.
- Chỉ còn một gói học phí hiển thị, giá 2.500.000 ₫. Khối ưu đãi dùng chế độ offer, không chạy đồng hồ thiếu hạn xác nhận.
- Các chunk giao diện đang phục vụ có CSS phân cấp mới và marker `data-lp-content-typography`.
- Kiểm tra trực tiếp shared trong container xác nhận tiêu đề mẫu không gắn nguồn user không còn bị bảo vệ nhầm.
- Bộ conversion bổ sung một ca chống hồi quy cho lỗi bảo vệ tiêu đề; tổng năm bộ là 86 ca.

Kết quả HTTP lưu tại `.tmp/lp-conversion/http-live-result.json`. Kiểm tra Chrome trực quan đã bị công cụ Computer Use dừng do không xác định được URL Windows đủ chắc chắn; không có kết quả kiểm thử trực quan mới. Các giới hạn build ở phần cuối báo cáo là trạng thái của lượt sửa trước, đã được thay bằng kết quả build Docker thành công ở lượt này. Chưa triển khai VPS/production bên ngoài máy local.

## Phân tích trường hợp SEO Digi

Đối chiếu ảnh người dùng với [website nguồn](https://daotaoseodigi.com/): trang đang bán khóa học nhưng còn nhãn nội bộ như “Lợi ích sản phẩm”, “Ảnh sản phẩm”, một khối ra mắt Aibeego và các gói agency. Đây là lỗi phối hợp giữa biên tập, chọn đề xuất và kiểm tra bản xem trước; chỉ sửa prompt không xử lý hết.

Hero cần diễn đạt giá trị và cách học thay cho việc chỉ ghép tên sản phẩm với thương hiệu. Các phần tiếp theo cần có nhiệm vụ riêng: vấn đề → giá trị → chương trình → đối tượng → phương pháp → giải đáp → hành động. Những điểm khác biệt phải có căn cứ trong nguồn, không suy ra ưu thế so với đối thủ hoặc thêm lời hứa kết quả.

## Thay đổi đã thực hiện

- Prompt chung và prompt khóa học yêu cầu nội dung cụ thể, tiêu đề truyền đạt giá trị, mô tả cơ chế và CTA phù hợp đích đến. Bổ sung hướng dẫn độ dài, phân biệt H1/H2/tiêu đề thẻ và tránh lặp ý.
- Bộ kiểm tra chung từ chối các tiêu đề nhãn mẫu ở cả chế độ URL và nhập thông tin thủ công; câu AI bị từ chối được thay bằng đề xuất dự phòng có chẩn đoán.
- Bản biên tập dự phòng rút gọn một số nhóm vấn đề, lợi ích và phương pháp SEO từ dữ kiện nhận diện được. Chủ đề khác giữ nội dung nguồn. Không thêm dữ kiện giá, chứng chỉ, thu nhập hoặc cam kết.
- Bản xem trước phát hiện tiêu đề chung chung, trùng lặp và tiêu đề mới chưa áp dụng. Các vấn đề này được tính vào phần cần kiểm tra khi áp dụng lựa chọn.
- Mặc định chọn các đề xuất đủ dữ liệu và thao tác ẩn demo thiếu dữ kiện không bị bảo vệ. Người dùng xem trước và có thể bỏ chọn trước khi áp dụng; không tự xuất bản.
- Một mức giá chỉ thay một gói được chọn; các gói mẫu khác được đề xuất ẩn. Không dùng cùng mức giá để bật mọi đồng hồ ra mắt trong mẫu. Hai CTA khóa học không còn bị ghi đè bằng cùng một tiêu đề ưu đãi.
- Thêm phân cấp chữ cho trang có nội dung AI: H1 lớn hơn H2, H2 lớn hơn H3; có cỡ riêng khi xem trước mobile/tablet. Giữ font-size khai báo trực tiếp và kích thước đã được người dùng duyệt. CSS mới áp dụng ngoài lớp loại trừ của nền tảng legacy để hỗ trợ cả mẫu Agency.

## Kiểm chứng

Đã chạy thành công 85 ca kiểm tra trong năm bộ:

| Bộ kiểm tra | Số ca |
| --- | ---: |
| `test-landing-page-template-content.ts` | 38 |
| `test-landing-page-template-content-v2.ts` | 24 |
| `test-landing-page-template-pricing.ts` | 11 |
| `test-landing-page-seo-editorial.ts` | 7 |
| `test-landing-page-template-conversion.ts` | 5 |

Bộ SEO dùng bản HTML nguồn có sẵn ở `.tmp/lp-seo-editorial/source.html`, kiểm tra đủ 10 học phần. Các kiểm tra này chạy cục bộ bằng compiler dự phòng, không gọi AI thật hoặc ghi database. Kiểm tra cú pháp 10 file TypeScript/TSX thay đổi không có lỗi. `git diff --check` không báo lỗi khoảng trắng.

## Phạm vi chưa kiểm chứng

Workspace chưa có `node_modules`: kiểm tra kiểu bằng script hiện có và bộ kiểm tra URL phụ thuộc thư viện ngoài chưa chạy được. Không có kết quả build/typecheck đầy đủ hoặc kiểm thử tích hợp API/AI sau thay đổi. Chrome headless không khởi động thành công (exit code -2147483645), nên chưa xác nhận trực quan CSS mới bằng trình duyệt; script `qa-landing-page-template-conversion.cjs` chỉ tạo fixture kiểm tra typography riêng.

Chưa triển khai lên máy chủ và chưa thay trang đang xuất bản. Cần cài dependency theo lockfile, chạy build/typecheck, thử tạo nội dung từ URL với AI thật, kiểm tra preview desktop/tablet/mobile và lưu–tải lại trước khi phát hành. Hiệu quả chuyển đổi thực tế cần đo từ lượt gửi form và thử nghiệm nội dung sau triển khai.
