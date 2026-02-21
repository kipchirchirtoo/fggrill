-- Insert Sales Points for Kyogong (Branch ID 1)
INSERT INTO sales_points (branch_id, name, code, is_active, supports_petty_cash) VALUES
(1, 'Spa', 'SPA', true, false),
(1, 'Executive Bar', 'EXEC_BAR', true, false),
(1, 'Sports Bar', 'SPORTS_BAR', true, false),
(1, 'Reception', 'RECEPTION', true, true) -- Reception supports petty cash
ON CONFLICT (branch_id, code) DO NOTHING;

-- Insert Dynamic Services
INSERT INTO dynamic_services (branch_id, service_type, name, pricing_model, base_price, is_active) VALUES
(1, 'spa', 'Full Body Massage', 'fixed', 2500, true),
(1, 'spa', 'Facial Scrub', 'fixed', 1500, true),
(1, 'sauna', 'Sauna Session', 'fixed', 1000, true),
(1, 'swimming', 'Swimming Session (Adult)', 'fixed', 500, true),
(1, 'swimming', 'Swimming Session (Child)', 'fixed', 300, true),
(1, 'car_wash', 'Saloon Car Wash', 'fixed', 500, true),
(1, 'car_wash', 'SUV Car Wash', 'fixed', 800, true),
(1, 'car_wash', 'Underwash', 'fixed', 400, true);
