# Phiên đăng nhập & truy cập tệp — kiểm kê client và chuyển đổi

## Refresh token (API)

- Refresh token nằm trong cookie HttpOnly `ms_refresh_token` (web).
- Body `refreshToken` vẫn được chấp nhận tại `POST /api/v1/auth/refresh` cho client cũ / script QA.
- Xoay refresh **nguyên tử**: hai request song song cùng token → một thành công, một `401` + `code: REFRESH_ALREADY_USED`.
- Web dùng `navigator.locks` + `BroadcastChannel` (`ms-auth-v1`) để tab thua không `clear()` access token khi tab khác đã refresh.

## Access token (web)

| Lưu trữ | Trạng thái |
|---------|------------|
| `localStorage.ms_access_token` | Hiện tại (SPA) — **đánh giá chuyển sang memory/cookie sau** khi reload/OAuth/multi-tab ổn định trên QA |
| `localStorage.ms_refresh_token` | Legacy — không dùng; chỉ xóa khi clear |

## Socket.IO (`/events`)

| Cách | Trạng thái |
|------|------------|
| `handshake.auth.token` (access JWT) | **Chuẩn** — `RealtimeProvider` |
| `?token=` query | **Deprecated** — server vẫn chấp nhận, ghi log cảnh báo |

## Tải file `/uploads/*`

| Cách | Trạng thái |
|------|------------|
| `Authorization: Bearer <access JWT>` | Chuẩn — `apiDownload`, fetch có header |
| `?exp=&sig=` HMAC | Chuẩn cho `<img>` / preview — API ký qua `withSignedUploadUrl` (HRM, work collab, …) |
| `?access_token=<JWT>` | **Deprecated** — header `Deprecation: true`; dùng Bearer hoặc link ký |

Quyền tài nguyên: path `hrm/{orgId}/...` và `work/{orgId}/...` so khớp `organizationId` trong JWT (trừ `SUPER_ADMIN`).

## Client cần sửa (nếu còn)

- Embed / bookmark cũ gắn `access_token` trên URL ảnh → đổi sang URL đã ký từ API hoặc fetch blob + `blob:` URL.
- Mobile / integration gọi refresh: gửi cookie hoặc body `refreshToken`; xử lý `REFRESH_ALREADY_USED` bằng giữ access token còn hạn.

## Access token ngoài localStorage (kế hoạch)

**CHƯA TRIỂN KHAI** trong đợt này. Điều kiện nghiệm thu trước khi bật:

1. Reload trang khôi phục phiên qua cookie refresh.
2. Google OAuth + OTP đăng ký giữ cookie refresh.
3. Hai tab refresh đồng thời không đá nhau.
4. Socket reconnect sau refresh.

## IP & rate limit

- `TRUST_PROXY=1` (mặc định): Express tin cậy hop đầu — `ClientIp` dùng `request.ip` (không đọc trực tiếp `X-Forwarded-For`).
- Rate limit auth (login/OTP/refresh) dùng `RateLimitService` in-process; Redis quota LP đã có pattern riêng — mở rộng Redis toàn cục **CHƯA** trong diff này (fail-open khi Redis down: giữ in-memory).