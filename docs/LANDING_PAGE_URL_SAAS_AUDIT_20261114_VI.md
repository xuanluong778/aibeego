# Rà soát và tối ưu “Tạo nội dung từ URL” — 14/11/2026

## Phạm vi và kết luận

Đã đọc luồng dialog → API đọc URL → tokenizer/brief → biên tập AI/fallback → validation → preview/apply, đối chiếu ảnh người dùng gửi. Đã sửa trực tiếp mã nguồn và kiểm thử trong container QA riêng. Không sửa bản nháp trong database, không xuất bản, không thay container local đang phục vụ, không triển khai production.

Đây là bản cải thiện chất lượng nội dung và độ ổn định khi nhiều API cùng phục vụ. Chưa nên kết luận toàn bộ tính năng đã sẵn sàng bán SaaS: phần tính credit riêng, tác vụ bền vững và gate TypeScript toàn web vẫn cần hoàn thiện.

Repository đã có nhiều thay đổi chưa commit từ trước; các thay đổi đó được giữ nguyên.

## Vấn đề tìm được và phần đã sửa

| Vấn đề | Nguyên nhân trong source | Thay đổi |
| --- | --- | --- |
| Tiêu đề mẫu, bảng giá cũ và countdown còn xuất hiện | UI mặc định chỉ chọn đề xuất ready không được bảo vệ; missing/hide phải được duyệt riêng. Cảnh báo cũ không kiểm tra đầy đủ kết quả preview thực tế | Thêm `reviewTemplateContent`, chỉ ra tiêu đề chưa thay, khối/thẻ/ảnh cần xác nhận còn hiển thị; có đường dẫn đến khối và xác nhận khi áp dụng từng phần chưa xử lý hết |
| Nhiều thẻ lặp cùng một dữ kiện | `groupsFor` phân bổ cùng một fact cho nhiều thẻ khi số fact nhỏ hơn số thẻ; loại section thiếu fact còn lấy fact của nhóm khác để lấp chỗ | Phân bổ fact riêng; không lấp vấn đề bằng giáo trình. Đề xuất ẩn từng thẻ thừa, không ẩn cả chương trình còn dữ liệu hợp lệ |
| Thao tác ẩn thẻ có thể ảnh hưởng nội dung người dùng | Trước đó chỉ có visibility cho cả khối | Bổ sung visibility theo ID item, dùng `elementHidden` hiện có; giữ khóa, bảo vệ nội dung đã chỉnh và phát hiện xung đột; không xóa cấu trúc mẫu |
| Chỉ có nhánh biên tập cho khóa học SEO | `buildEditorialContext` thoát sớm nếu topic không phải SEO | Cho phép khóa học khác có đủ section, giáo trình và fact đi qua nhánh biên tập. Copy mặc định cho khóa học khác không tự chèn Google, GA4 hoặc website. Ngành sản phẩm/dịch vụ khác vẫn dùng pipeline cũ |
| Nguồn có thể vượt ngân sách dù plaintext đã giới hạn | `sourceSections` trả `sections: unique` chưa giới hạn thay vì chính phần đã đưa vào text | Text và section có cùng ngân sách; không gửi lại đoạn đã bị loại qua đường structured facts |
| Fallback có thể cắt ngang câu | `fit` cắt tại khoảng trắng gần giới hạn ký tự | Dùng `completeCopy`; không có câu trọn ý phù hợp thì trả missing |
| Fact ID chưa đủ ngăn số liệu/quyền lợi sai | Validator cho phép số có trong corpus nhưng chưa kiểm tra chặt đơn vị và một số tuyên bố như miễn phí | Kiểm tra thêm số kèm %, buổi, thời gian; kiểm tra từ ngữ miễn phí, 24/7, trọn đời, hàng đầu… theo dữ kiện. Bỏ mô tả rộng khỏi corpus kiểm chứng fact để tránh hợp thức hóa số từ đoạn không liên quan |
| Nhiều lô AI gây tăng tải, thời gian kéo dài | Nhánh generic dùng `Promise.all` trên toàn bộ batch; nhánh editorial chưa có deadline toàn yêu cầu | Tối đa hai lô đồng thời cho mỗi yêu cầu, ngân sách 85 giây cho phần gọi AI; lô chưa chạy khi hết thời gian dùng fallback và diagnostic |
| Timeout AI chỉ bao phủ HTTP header | `OpenAiService.chatCompletion` hủy timer trước khi đọc JSON | Giữ timer đến khi đọc xong body; body bị treo cũng bị abort; giữ nguyên giao thức gọi AI |
| Phiên URL mất khi chuyển replica hoặc restart API | Receipt nằm trong `Map`, tối đa 100 entry cho cả process | Dùng Redis sẵn có với TTL 15 phút và key tenant/user/page/source. Khi có Redis nhưng chưa ready thì báo lỗi, không lùi về RAM để né kiểm soát. Không cấu hình Redis vẫn có local fallback hữu hạn |
| Rate limit và chống gọi trùng chỉ ở từng process | Nhánh template-content chưa dùng shared idempotency; rate limit URL/AI là Map | Dùng counter Redis nguyên tử theo cửa sổ thời gian; đưa template-content vào cơ chế Redis lock/result có sẵn. Key kết quả gắn fingerprint brief/snapshot/block để tránh trả nội dung cũ khi body thay đổi |
| Thử lại sau mất mạng tạo lượt mới | UI tạo UUID mới cho mỗi lần bấm | Giữ key cho cùng request chưa thành công; khi nhận kết quả thành công, lần chủ động tạo lại sẽ dùng key mới |
| Dữ liệu QA tạm có thể đi vào image build | `.dockerignore` chưa bỏ `.tmp` | Loại `.tmp` khỏi build context |

Việc ẩn vẫn phải được người dùng duyệt. Nội dung tự chỉnh, vị trí khóa, đích CTA, cấu hình form và theme được giữ theo cơ chế cũ. Hệ thống không tự xuất bản.

## Kiểm thử và giới hạn của bằng chứng

| Bộ kiểm thử | Số kiểm tra đạt |
| --- | ---: |
| `test-landing-page-url-upgrade.ts` — preview thực tế, ẩn thẻ, ngân sách nguồn, khóa học thiết kế, kiểm chứng số liệu và đủ giáo trình SEO còn hiển thị | 8 |
| `test-landing-page-url-upgrade-service.ts` — hai replica, scope nguồn, idempotency đồng thời, quota, ngân sách AI, body timeout | 9 |
| `test-landing-page-seo-editorial.ts` | 7 |
| `test-landing-page-template-url.ts` — gồm SSRF/DNS/redirect/size/timeout | 11 |
| `test-landing-page-template-content.ts` | 38 |
| `test-landing-page-template-content-v2.ts` | 24 |
| `test-landing-page-template-content-service.cjs` — service đã biên dịch | 25 |
| Tổng | **122** |

- Shared TypeScript build, API build theo `nest-cli.isolated.json` của dự án và production web build đã đạt trong container QA riêng.
- Kiểm tra TypeScript riêng dialog và helper review mới: 0 lỗi tại hai file mục tiêu. Cây dependency được kéo vào có 23 diagnostic ở các file khác, gồm canvas, countdown, HTML isolate, preview viewport và API client. Không coi đây là full-project typecheck đạt.
- `next.config.js` hiện bật `ignoreBuildErrors` và `ignoreDuringBuilds`; production web build thành công không thay thế gate TypeScript/lint nghiêm ngặt.
- Test nguồn SEO dùng snapshot HTML local tại `.tmp/lp-seo-editorial/source.html`: 10 học phần, 4 nhóm đối tượng. Không gọi lại website hoặc AI thật trong lượt kiểm thử nâng cấp này.
- Test nhiều replica dùng Redis giả lập dùng chung, không phải load test với Redis cluster thật. Provider và database trong test service được mock; không phát sinh chi phí AI, ghi database hay publish.
- Chưa kiểm thử tương tác browser đầu cuối cho phiên bản vừa sửa. Các kết quả browser trong tài liệu cũ không được tính là bằng chứng mới.

Lệnh kiểm thử mới (chạy từ thư mục gốc, có dependency workspace):

```sh
pnpm --filter @marketingspa/database exec tsx ../../scripts/test-landing-page-url-upgrade.ts
pnpm --filter @marketingspa/database exec tsx --tsconfig ../../apps/api/tsconfig.json ../../scripts/test-landing-page-url-upgrade-service.ts
node scripts/check-landing-page-url-upgrade-types.cjs --details
```

Để test snapshot SEO được chạy từ thư mục gốc, dùng binary tsx của workspace hoặc runner `scripts/run-landing-page-url-upgrade-tests.cjs` với TypeScript có sẵn. Nếu snapshot không có, kiểm tra riêng nguồn thật phải hiện SKIP; không tính là đã kiểm chứng nguồn thật.

## Những việc cần hoàn thiện trước khi mở bán rộng

### P0 — Thu phí và release gate

1. Luồng `generateTemplateContent` chưa có feature credit riêng tương đương `LANDING_PAGE_INLINE_AI`. Cần định giá qua admin, kiểm tra số dư, reserve/commit/release theo ledger, chống trừ trùng và phân biệt fallback chưa gọi provider. Rate limit không thay thế hạn mức chi phí theo gói.
2. Chạy browser E2E trên bản build mới: đọc URL, sửa brief, preview, ẩn thẻ, bảo vệ field đã sửa, autosave/reload, mobile và xác nhận không gọi publish.
3. Kiểm thử Redis thật với ít nhất hai API, reconnect/restart và yêu cầu trùng; bổ sung gate TypeScript/lint cần thiết trước khi rollout.

### P1 — Tác vụ bền vững và quan sát vận hành

4. Hiện vẫn là request dài; nên đưa tạo nội dung vào job có ID, tiến độ, timeout, retry hữu hạn và kết quả lưu để mở lại sau reload. Ref idempotency ở UI chỉ tồn tại trong lần mở dialog, chưa thay thế job bền vững.
5. Ghi usage theo tenant/job: thời gian crawl/AI, số lô, token/chi phí nếu provider trả usage, tỷ lệ fallback, lỗi có mã và tỷ lệ người dùng áp dụng. Không ghi HTML, token hay dữ liệu cá nhân nguyên văn vào log.
6. Cho sửa hồ sơ trích xuất có nguồn đối chiếu từng trường, đánh dấu dữ liệu mâu thuẫn hoặc có tính thời điểm; kiểm chứng theo heuristic vẫn cần người dùng duyệt.

### P2 — Chất lượng theo ngành

7. Mở rộng bộ dữ kiện và lộ trình nội dung cho sản phẩm, dịch vụ, nhà hàng, sự kiện… bằng schema phù hợp; kiểm thử bằng nhiều nguồn, tránh hard-code SEO Digi.
8. Bộ lấy HTML tĩnh vẫn không đọc được mọi trang JavaScript/CAPTCHA/đăng nhập. Khi cần renderer, phải chạy cách ly và áp dụng kiểm soát mạng cho mọi tài nguyên con; không bỏ chặn SSRF để tăng tỷ lệ lấy nội dung.
9. Chọn ảnh theo nội dung/vị trí, phát hiện ảnh trùng, cho người dùng xác nhận quyền sử dụng và lựa chọn trước khi nhập media.

Không thêm migration hay biến môi trường bắt buộc trong bản sửa này; Redis tái sử dụng cấu hình hiện có. Không tự sửa lại các landing page đã lưu: sau khi triển khai cần đọc lại URL, tạo đề xuất mới và duyệt áp dụng.
