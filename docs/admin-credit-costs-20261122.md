# Quản trị viên → Credit costs

Đã triển khai local tại `/admin/credit-costs`, thêm mục **Credit costs** trong menu quản trị.

Trang liệt kê toàn bộ `credit_feature_pricing`: Module, Action, tên/mô tả, đơn vị, mức credit, tổng credit và số lần trừ trong 30 ngày. Có tìm kiếm và lưu từng dòng. Tạo ảnh chưa có provider được đánh dấu cấu hình dự phòng. Không thêm cấu hình cache không có tác dụng trong runtime hiện tại.

Chỉ SUPER_ADMIN được xem/sửa qua JWT + PlatformAdminGuard. Mỗi lần lưu nhận `creditCost` (số nguyên 1–1.000.000) và `expectedUpdatedAt`. API trả 409 nếu một phiên khác đã sửa; giá và audit `PLATFORM_CREDIT_COST_UPDATED` commit trong cùng transaction. Nhật ký chứa người sửa, mã tác vụ, mức trước/sau và IP. Không tạo/sửa số dư hoặc lịch sử tiêu credit khi chỉnh giá.

API/worker lấy giá từ DB qua `getFeatureCost`, nên tác vụ mới nhận giá mới ngay. Reservation đã tồn tại giữ số tiền cũ. Seed pricing cập nhật tên/mô tả nhưng giữ mức credit đã tùy chỉnh; dòng mới vẫn nhận giá mặc định.

Kiểm tra đã đạt:

- `scripts/test-admin-credit-costs.cjs`: controller Nest, DTO, admin guard, Prisma và audit thật trên DB QA riêng. Kiểm tra 401/403, dữ liệu sai 400, không tồn tại 404, xung đột 409, cập nhật đồng thời, audit rollback, usage 30 ngày và OpenAI gateway dùng đúng giá vừa lưu.
- `scripts/test-admin-credit-costs-worker.cjs`: worker riêng nhận cùng giá vừa lưu qua API và trừ đúng; không có provider trả phí thật. Đã chạy lại seed trên QA và xác nhận giá custom được giữ.
- Typecheck API đạt. Typecheck web không có lỗi ở trang/hook/layout vừa sửa; còn 127 lỗi ở các phần có sẵn, lưu trong `tmp/admin-credit-costs-20261122/web-typecheck.log`. Web production build đạt với cấu hình hiện hành bỏ kiểm tra type/lint.
- `scripts/verify-local-admin-credit-costs.cjs`: menu thật, trang 15 dòng, tìm kiếm, nhập/lưu với phản hồi fixture, desktop/mobile không tràn trang và không có lỗi JavaScript. Kiểm tra live chỉ đọc; không đổi giá thật để thử UI. Backend lưu thật được kiểm tra trên QA.

Override cuối: `deploy/local-admin-credit-costs.yml`. API kế thừa image credit-economy và chỉ thêm bốn module quản trị; web build từ nguồn hiện tại. Không migration schema, không đổi mức giá hiện tại khi triển khai. Script deployment giữ image cũ, snapshot pricing, kiểm tra health và đối chiếu cấu hình trước/sau. Artifacts và ảnh UI trong `tmp/admin-credit-costs-20261122/`.
