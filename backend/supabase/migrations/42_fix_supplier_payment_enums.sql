-- Add 'mpesa' to payment_method_type enum
-- This matches usage in other finance modules and the frontend
ALTER TYPE public.payment_method_type ADD VALUE IF NOT EXISTS 'mpesa' AFTER 'mobile_money';
