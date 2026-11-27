# [FLOW-042] Chiến dịch Marketing Autopilot Tự động Có Bảo vệ Ngân sách (Missions & Guardrails)

> **Tầng nghiệp vụ**: TẦNG 10: QUẢNG CÁO AI, MARKETING AUTOPILOT & PHÂN BỔ (ATTRIBUTION)  
> **Thứ tự thực thi**: 42 / 62  
> **Nguyên tắc cốt lõi**: "CÓ A THÌ MỚI CÓ B" — Chỉ kích hoạt khi các điều kiện tiên quyết đã sẵn sàng.

---

## 1. ĐIỀU KIỆN TIÊN QUYẾT ("CÓ A")
* FLOW-007 (`BusinessProfile`), FLOW-011 (Credit AI), FLOW-013/014/015/016 (Các kênh đã kết nối).

## 2. TÁC NHÂN THAM GIA (ACTORS)
* Chủ doanh nghiệp / Marketer + Marketing Autopilot Engine

## 3. THÀNH PHẦN HỆ THỐNG LIÊN QUAN (CODEBASE ARCHITECTURE)
* **UI Routes**: `/marketing-autopilot`.
* **API Endpoints**: `GET /marketing-autopilot/context`, `POST /marketing-autopilot/autofill`, `GET/POST /marketing-autopilot/projects*`, `POST /marketing-autopilot/projects/:id/confirm`, `POST /marketing-autopilot/missions/:missionId/approve|resume`, `GET /marketing-autopilot/missions/:missionId/outcome-loop|optimization-proposals`, `POST /marketing-autopilot/optimization-proposals/:proposalId/approve`.
* **Models**: `MarketingAutopilotProject`, `MarketingAutopilotAnalysis`, `MarketingMission`, `MarketingMissionApproval`, `MarketingAutopilotGuardrail`, `MarketingAutopilotExecutionLog`, `MarketingAutopilotOutcomeLoop`, `MarketingAutopilotStopLossEvent`, `MarketingAutopilotBusinessLearning`.

## 4. QUY TRÌNH THỰC HIỆN CHI TIẾT (STEP-BY-STEP)
1. Hệ thống gom ngữ cảnh toàn doanh nghiệp (`MarketingContextSnapshot`) và điền tự động thông số chiến dịch (`autofill`).
2. Tạo dự án Autopilot (`POST /marketing-autopilot/projects`): AI phân tích và sinh bản kế hoạch (`plan`), ý tưởng nội dung (`content-ideas`), bản nháp phễu (`MarketingAutopilotFunnelSpec`) và email (`MarketingAutopilotEmailDraft`).
3. Người dùng xem xét và xác nhận (`confirm`) để khởi tạo `MarketingMission` kèm ngưỡng bảo vệ `MarketingAutopilotGuardrail`.
4. Phê duyệt thực thi (`missions/:missionId/approve`): hệ thống triển khai đồng bộ tài nguyên (`MarketingMissionAsset`) và bước vào vòng lặp theo dõi kết quả (`OutcomeLoop`).
5. Nếu hiệu quả thấp chạm ngưỡng rủi ro: kích hoạt `StopLossEvent` dừng lỗ; nếu có phương án tối ưu: tạo `OptimizationProposal` chờ duyệt và rút bài học (`BusinessLearning`).

## 5. DỮ LIỆU ĐẦU VÀO & ĐẦU RA (INPUT / OUTPUT)
* **Đầu vào (Input)**: Mục tiêu doanh thu/lead, ngân sách, khung thời gian dự án.
* **Đầu ra (Output)**: Chiến dịch đa kênh chạy khép kín từ Content -> Funnel -> Email -> Ads -> Outcome Loop.

## 6. KIỂM SOÁT NGOẠI LỆ, BẢO MẬT & TÍNH TOÀN VẸN
* Cơ chế khóa đột biến `OutcomeMutationLock`, `Guardrail` chống vượt ngân sách, `StopLossEvent` cắt lỗ tự động.

## 7. MỞ KHÓA LUỒNG TIẾP THEO ("MỚI CÓ B")
* **Kích hoạt / Mở khóa**: FLOW-043

---

## ĐIỀU HƯỚNG LIÊN KẾT LUỒNG

[⬅️ **Luồng trước**: FLOW-041](./FLOW-041-quan-ly-quang-cao-ai.md) | [📋 **Mục lục 62 Flows**](./README.md) | [➡️ **Luồng tiếp theo**: FLOW-043](./FLOW-043-do-luong-nguon-goc-chuyen-doi-ban-nguoc-offline-conversion-cap.md)
