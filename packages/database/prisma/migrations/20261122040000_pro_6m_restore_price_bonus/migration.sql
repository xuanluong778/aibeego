-- Pro/VIP six-month terms receive one bonus month in payment fulfillment.
-- Keep the billing term at six months; existing subscriptions/orders are unchanged.
UPDATE subscription_plans
SET price_vnd = 4800000,
    price_monthly = 800000,
    savings_amount = 0
WHERE code = 'abg-pro-6m';
