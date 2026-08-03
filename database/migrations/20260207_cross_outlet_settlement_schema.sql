-- Migration: 20260207_cross_outlet_settlement_schema.sql
-- Description: Cross-Outlet Settlement Ledger for Master Bills

ALTER TABLE public.pos_master_bill_settlements 
ADD COLUMN IF NOT EXISTS supplying_outlet_id UUID,
ADD COLUMN IF NOT EXISTS supplying_outlet_name TEXT,
ADD COLUMN IF NOT EXISTS supplying_cashier_id UUID,
ADD COLUMN IF NOT EXISTS supplying_cashier_name TEXT,
ADD COLUMN IF NOT EXISTS collecting_outlet_id UUID,
ADD COLUMN IF NOT EXISTS collecting_outlet_name TEXT,
ADD COLUMN IF NOT EXISTS collecting_cashier_name TEXT,
ADD COLUMN IF NOT EXISTS mpesa_reference TEXT,
ADD COLUMN IF NOT EXISTS shift_id UUID,
ADD COLUMN IF NOT EXISTS collecting_shift_id UUID;

CREATE INDEX IF NOT EXISTS idx_pos_master_bill_settlements_supplying_outlet 
ON public.pos_master_bill_settlements(supplying_outlet_id, status);

CREATE INDEX IF NOT EXISTS idx_pos_master_bill_settlements_collecting_cashier 
ON public.pos_master_bill_settlements(collecting_cashier_id, status);

CREATE INDEX IF NOT EXISTS idx_pos_master_bill_settlements_shift 
ON public.pos_master_bill_settlements(shift_id);
