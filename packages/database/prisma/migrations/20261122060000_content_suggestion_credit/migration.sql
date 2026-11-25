-- Give short content suggestions their own configurable price; retain every custom rate.
INSERT INTO credit_feature_pricing(id,feature_code,name,credit_cost,description,is_active,sort_order,created_at,updated_at)
VALUES ('credit-content-ai-suggest','content_ai.suggest','Content AI — gợi ý ngắn',
  COALESCE((SELECT credit_cost FROM credit_feature_pricing WHERE feature_code='email_ai.subject'),10),
  'Gợi ý tiêu đề, ý tưởng, trường nội dung hoặc CTA; cấu hình riêng với Email AI',true,15,NOW(),NOW())
ON CONFLICT(feature_code) DO NOTHING;
