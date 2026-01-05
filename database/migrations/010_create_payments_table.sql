-- Create payments table for M-Pesa and Paystack integration
-- Migration: 010_create_payments_table.sql

-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference VARCHAR(255) UNIQUE NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'KES',
    payment_method VARCHAR(50) NOT NULL, -- 'mpesa', 'paystack', 'card', etc.
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'cancelled'
    booking_id UUID REFERENCES reservations(id) ON DELETE SET NULL,
    folio_id UUID, -- For future folio integration
    metadata JSONB DEFAULT '{}', -- Store gateway-specific data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_payments_reference ON payments(reference);
CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_payment_method ON payments(payment_method);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_payments_updated_at();

-- Add comments
COMMENT ON TABLE payments IS 'Payment transactions for bookings and folios';
COMMENT ON COLUMN payments.reference IS 'Unique payment reference from gateway';
COMMENT ON COLUMN payments.amount IS 'Payment amount in the specified currency';
COMMENT ON COLUMN payments.currency IS 'Payment currency (KES, USD, etc.)';
COMMENT ON COLUMN payments.payment_method IS 'Payment gateway used (mpesa, paystack, etc.)';
COMMENT ON COLUMN payments.status IS 'Payment status (pending, completed, failed, cancelled)';
COMMENT ON COLUMN payments.booking_id IS 'Associated booking/reservation ID';
COMMENT ON COLUMN payments.folio_id IS 'Associated folio ID for hotel charges';
COMMENT ON COLUMN payments.metadata IS 'Gateway-specific metadata (JSON)';
