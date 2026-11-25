# Pro/VIP mua 6 tháng tặng 1 tháng

Theo yêu cầu mới, Pro 6 tháng quay về 4.800.000 VND. VIP 6 tháng giữ giá 10.794.000 VND. Cả hai gói nhận thêm một tháng, tổng bảy tháng sử dụng. Basic và các kỳ một/năm không thay đổi.

`durationMonths` tiếp tục là kỳ mua sáu tháng để giữ tab giá, checkout và lịch sử tương thích. Hàm `planBonusMonths` xác định một tháng tặng cho `abg-pro-6m` và `abg-vip-6m`. API trả `bonusMonths` và `totalUsageMonths` trong danh sách gói và thông tin gói của đơn hàng. Khi kích hoạt/gia hạn thanh toán, `extendSubscriptionTx` cộng bảy tháng lịch theo UTC; gia hạn bắt đầu từ hạn hiện tại còn hiệu lực, chuyển hạng tiếp tục xếp sau thời gian đã mua. Webhook gửi lặp vẫn đi qua khóa/idempotency cũ.

Tháng thứ bảy có quyền lợi và credit AI như tháng thông thường; credit cấp từng tháng, không cấp trước cả bảy tháng. Không cộng thời gian hồi tố cho subscription hiện có. Đơn cũ giữ nguyên số tiền đã lưu.

Migration `20261122040000_pro_6m_restore_price_bonus` chỉ cập nhật giá Pro, giá quy đổi/tháng và savings về 4.800.000/800.000/0; không sửa migration trước đã chạy. Catalog seed đồng bộ giá này.

Kiểm thử trên database QA riêng bằng `scripts/test-subscription-tiers.cjs` trong image candidate đã đạt: chín kỳ gói, giá QR, kích hoạt, hạn chính xác, gia hạn bảy tháng, credit trong tháng tặng, webhook lặp, chuyển hạng giữ quyền lợi cũ. TypeScript API/shared đạt. Typecheck toàn web còn lỗi ngoài phần thay đổi (admin, sales, Zalo, dictionary trùng khóa); cấu hình build web hiện hành bỏ kiểm tra type/lint. Xác nhận giao diện thực tế bằng `scripts/verify-local-pro-6m-price.cjs` cho desktop/mobile.

Triển khai local bằng `scripts/deploy-local-six-month-bonus.cjs` và override cuối `deploy/local-six-month-bonus.yml`. Image API kế thừa bản sửa upload hàng loạt, chỉ overlay billing service và catalog; web build từ nguồn hiện tại. Script lưu snapshot trước triển khai trong `tmp/six-month-bonus-20261122/before.json`, so sánh hash đơn hàng/subscription và giữ image trước sửa. Không migration cấu trúc database. Báo cáo sau triển khai và ảnh QA nằm trong cùng thư mục.
