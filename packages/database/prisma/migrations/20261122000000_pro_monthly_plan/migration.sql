-- Add monthly Pro without changing existing plans or subscriptions.
INSERT INTO "subscription_plans" (
  "id", "code", "name", "price_monthly", "price_vnd", "duration_months",
  "sort_order", "credits_included", "features", "is_active"
)
VALUES (
  'msp-pro-1m', 'msp-pro-1m', 'Ai Bee Go Pro — 1 tháng', 800000, 800000, 1,
  5, 0,
  '["crm_full","marketing_automation","ads_performance","chatbot_cskh","content_auto_post","hrm","messaging_campaigns","reports"]'::jsonb,
  true
)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "price_monthly" = EXCLUDED."price_monthly",
  "price_vnd" = EXCLUDED."price_vnd",
  "duration_months" = EXCLUDED."duration_months",
  "sort_order" = EXCLUDED."sort_order",
  "is_active" = EXCLUDED."is_active";
