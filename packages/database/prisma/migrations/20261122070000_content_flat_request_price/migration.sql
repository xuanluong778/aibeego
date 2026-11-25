UPDATE credit_feature_pricing
SET credit_cost = 20,
    description = CASE feature_code
      WHEN 'content_ai.generate' THEN 'Mỗi yêu cầu tạo/viết lại content; gồm toàn bộ bước AI nội bộ, không cộng thêm theo độ dài'
      ELSE 'Mỗi yêu cầu gợi ý AI; gồm toàn bộ bước AI nội bộ, không cộng thêm theo độ dài'
    END,
    updated_at = NOW()
WHERE feature_code IN ('content_ai.generate','content_ai.suggest');
