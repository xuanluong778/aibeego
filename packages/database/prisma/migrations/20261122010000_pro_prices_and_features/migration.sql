-- Current Pro prices and the full customer-facing feature set for all billing cycles.
-- Existing payment orders retain their original amount; future orders use these prices.
UPDATE "subscription_plans"
SET "price_vnd" = 4800000, "price_monthly" = 800000, "savings_amount" = NULL
WHERE "code" = 'msp-pro-6m';

UPDATE "subscription_plans"
SET "price_vnd" = 6500000, "price_monthly" = 541666.67, "savings_amount" = 3100000
WHERE "code" = 'msp-pro-12m';

UPDATE "subscription_plans"
SET "features" = '["crm_full","marketing_automation","ads_performance","chatbot_cskh","content_auto_post","hrm","messaging_campaigns","reports","overview","marketing_autopilot","landing_pages","appointments_services","content_ai","brand_building","content_ads_check","video_transcription","content_library","post_scheduling","fanpage_connections","teleprompter","messaging_audiences","messaging_flows","email_marketing","zalo_marketing","work_management","sales","inventory","purchasing","finance","business_goals","affiliate","ai_credit_management","settings_integrations"]'::jsonb
WHERE "code" IN ('msp-pro-1m', 'msp-pro-6m', 'msp-pro-12m');
