-- =====================================================
-- FIX GRN STATUS ENUM
-- Adds 'approved' status to grn_status enum
-- =====================================================

ALTER TYPE grn_status ADD VALUE IF NOT EXISTS 'approved';
