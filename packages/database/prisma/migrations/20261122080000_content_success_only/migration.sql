UPDATE credit_feature_pricing
SET credit_cost = CASE WHEN feature_code = 'content_ai.generate' THEN 20 ELSE 0 END,
    description = CASE WHEN feature_code = 'content_ai.generate'
      THEN 'Chỉ trừ khi tạo content thành công; gợi ý và các thao tác khác trong Content miễn phí'
      ELSE 'Miễn phí trong phần Content; không trừ credit khi bấm gợi ý' END,
    updated_at = NOW()
WHERE feature_code IN ('content_ai.generate', 'content_ai.suggest');
