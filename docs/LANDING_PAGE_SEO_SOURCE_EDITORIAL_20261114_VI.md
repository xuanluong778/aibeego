# Cải thiện nội dung URL cho khóa học SEO — 14/11/2026

Đã triển khai và cập nhật API/web Docker local tại http://localhost:8080. Chưa triển khai production. Không sửa bản nháp gốc của người dùng, không xuất bản.

## Nguyên nhân và thay đổi

- Bộ đọc cũ cắt nguồn ở 16.000 ký tự, giữ nội dung trùng giữa desktop/mobile và có thể cắt giữa câu. Giáo trình chưa được đưa vào brief; tiêu đề H1 trùng và tên thương hiệu kèm tagline làm giảm chất lượng ánh xạ.
- Bộ đọc mới giữ đoạn qua các thẻ inline, gắn tiêu đề cha, loại đoạn trùng và phân bổ nội dung theo section trong ngân sách 32.000 ký tự. Nguồn thử nghiệm còn 12.290 ký tự có ích, 62 section, thương hiệu **Đào Tạo SEO Digi**, 4 nhóm học viên và đủ 10 học phần.
- Với nguồn đào tạo SEO có đủ dữ kiện, backend lập hồ sơ nội dung theo vấn đề, lợi ích, giáo trình, đối tượng, phương pháp và đăng ký. AI nhận nhiệm vụ riêng cho từng section, viết lại trong giới hạn slot, kèm ID dữ kiện nguồn. Hai section cùng loại có vai trò khác nhau để tránh lặp ý.
- Giáo trình được phân bổ đủ vào các thẻ hiện có; kiểm tra cả thuật ngữ học phần thay vì chỉ tin ID trích dẫn. Kết quả sai schema, thiếu căn cứ, trùng hoặc bỏ học phần được thay bằng bản biên tập từ nguồn. Không cắt tùy tiện giữa câu.
- Nhãn section có thể thay theo chủ đề, được lưu và render qua cơ chế hiện có; tránh sót nhãn agency/dịch vụ/sản phẩm của mẫu. Giữ bố cục, theme, CTA đích, cấu hình form và media đã chọn.
- Dữ liệu URL mới thay các ô tự điền cũ nhưng giữ ô người dùng đã chủ động chỉnh. Vẫn xem trước, sửa, chọn nội dung và xác nhận trước khi áp dụng; chỉ lưu bản nháp.
- Học phí, lịch học, ưu đãi, đánh giá và cam kết chưa xác nhận không được tự tạo. Các khối không phù hợp được đề xuất ẩn sau bước duyệt, CTA chuyển sang tư vấn. Không tự tạo thời hạn hay bộ đếm.

## Kiểm thử

| Kiểm tra | Kết quả |
| --- | --- |
| URL thật https://daotaoseodigi.com/ qua crawler có bảo vệ, AI được cấu hình thật | Đạt; 10/10 học phần, 4 nhóm đối tượng, đúng thương hiệu; draft và trạng thái xuất bản giữ nguyên |
| Kết quả AI thật | 40 slot AI được chấp nhận; 31 trường không đạt kiểm chứng dùng nội dung biên tập có căn cứ từ nguồn; chế độ mixed |
| Browser với snapshot nguồn và kết quả AI thật được dùng lại | 18 kiểm tra đạt; preview không ghi dữ liệu, xác nhận áp dụng, autosave thật, reload giữ nguồn và thiết kế, preview bản nháp riêng tư, không gọi publish |
| Nội dung sau áp dụng | Đủ 10 học phần, không còn chữ agency/demo không liên quan; các khối Countdown/Pricing/Guarantee thiếu căn cứ được ẩn sau duyệt |
| Desktop / Tablet / Mobile | 1440 / 768 / 390 px; không tràn ngang hoặc cắt chữ ở các phần tử được kiểm tra; một H1 |
| Nhập URL và thử lại | 8 tình huống đạt, gồm URL thiếu scheme, URL sai, trang bị chặn, nhập tay, receipt hết hạn, AI lỗi và thử lại |
| Hồi quy | Shared 38 + 24, URL/SSRF 11, editorial 7, service đã biên dịch 25, database rollback 22 đều đạt |
| Build | Docker API và production web đạt; TypeScript riêng shared/crawler/dialog và diff whitespace đạt |

Build web vẫn bỏ qua full lint/typecheck theo cấu hình có sẵn. Kiểm tra browser thành công không phải mọi lần đều gọi lại provider: dùng lại kết quả canary thật để tránh chi phí AI lặp.

Script: `scripts/test-landing-page-seo-editorial.ts`, `scripts/canary-landing-page-seo-editorial.cjs`, `scripts/qa-landing-page-seo-editorial.cjs`. Bằng chứng local tại `.tmp/lp-seo-editorial/` gồm kết quả canary/browser và ảnh preview 3 kích thước. Fixture truy cập QA có token, không đưa vào tài liệu hay chia sẻ công khai.

## Cấu hình và giới hạn

Không thêm dependency, biến môi trường hoặc migration. Tái sử dụng dịch vụ AI/backend, media, autosave và renderer hiện có. Các bảo vệ xác thực, quyền tenant/page, rate limit, timeout, dung lượng, DNS pin và kiểm tra SSRF ở từng redirect được giữ nguyên. Nội dung website chỉ là dữ liệu, không được thực hiện chỉ dẫn. Khóa AI tiếp tục nằm ở backend.

Chiến lược biên tập chuyên ngành hiện kích hoạt cho nguồn khóa học SEO có đủ dữ kiện; ngành khác và luồng nhập tay giữ cơ chế cũ. Kiểm chứng theo quy tắc không thay thế việc người dùng duyệt nội dung. Nguồn phụ thuộc JavaScript, CAPTCHA hoặc đăng nhập vẫn có thể cần nhập tay. Nhiều lô AI và một lượt sửa có giới hạn có thể làm tăng thời gian/chi phí; trường không đạt sẽ dùng bản biên tập nguồn và hiện cảnh báo.

Đã dọn tổ chức, hai trang và media QA tạm; xác nhận tổ chức QA vừa tạo còn lại bằng 0.

Sau cập nhật, tải lại trình duyệt bằng Ctrl+F5, đọc lại URL và tạo đề xuất mới. Kết quả đã tạo trước cập nhật không tự thay đổi; cần duyệt phần đề xuất ẩn nội dung mẫu trước khi áp dụng.
