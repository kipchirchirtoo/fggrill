-- Migration to create hr_settings for statutory compliance (Kenya)

CREATE TABLE IF NOT EXISTS hr_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES users(id)
);

-- Seed Essential Kenyan Statutory Rates (2024/2025)

-- 1. PAYE Bands (Annual and Monthly)
INSERT INTO hr_settings (key, value, description) VALUES
('paye_bands', '[
    {"threshold": 24000, "rate": 0.10},
    {"threshold": 32333, "rate": 0.25},
    {"threshold": 500000, "rate": 0.30},
    {"threshold": 800000, "rate": 0.325},
    {"threshold": 999999999, "rate": 0.35}
]', 'Kenya PAYE tax bands (Monthly)')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 2. NSSF Tier I & II
INSERT INTO hr_settings (key, value, description) VALUES
('nssf_rates', '{
    "tier_1_limit": 7000,
    "tier_2_limit": 36000,
    "rate": 0.06
}', 'NSSF contribution rates and limits (Tier I and II)')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 3. SHIF (Social Health Insurance Fund)
INSERT INTO hr_settings (key, value, description) VALUES
('shif_rate', '{"rate": 0.0275}', 'SHIF contribution rate (2.75% of gross pay)')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 4. Affordable Housing Levy
INSERT INTO hr_settings (key, value, description) VALUES
('housing_levy_rate', '{"rate": 0.015}', 'Housing Levy rate (1.5% for both employer and employee)')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 5. Personal Relief
INSERT INTO hr_settings (key, value, description) VALUES
('personal_relief', '{"amount": 2400}', 'Monthly personal tax relief')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Enable RLS
ALTER TABLE hr_settings ENABLE ROW LEVEL SECURITY;

-- Governance Policies
CREATE POLICY "Management can view HR settings"
  ON hr_settings FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'manager', 'accountant')));

CREATE POLICY "Super admin can manage HR settings"
  ON hr_settings FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'));
