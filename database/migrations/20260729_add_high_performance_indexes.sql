-- High Performance Database Indexes for Supabase PostgreSQL
-- Optimizes Room Bills, Cashier Station, Reception Module, and Guest Charging

-- 1. Reservations Indexes
CREATE INDEX IF NOT EXISTS idx_reservations_branch_status ON reservations(branch_id, status);
CREATE INDEX IF NOT EXISTS idx_reservations_room_status ON reservations(room_id, status);
CREATE INDEX IF NOT EXISTS idx_reservations_guest_id ON reservations(guest_id);
CREATE INDEX IF NOT EXISTS idx_reservations_check_in ON reservations(check_in_date DESC);
CREATE INDEX IF NOT EXISTS idx_reservations_room_number ON reservations(room_number);

-- 2. Folios Indexes
CREATE INDEX IF NOT EXISTS idx_folios_reservation_id ON folios(reservation_id);
CREATE INDEX IF NOT EXISTS idx_folios_branch_status ON folios(branch_id, status);
CREATE INDEX IF NOT EXISTS idx_folios_settled_bal ON folios(settled, balance);

-- 3. Folio Transactions Indexes
CREATE INDEX IF NOT EXISTS idx_folio_transactions_folio_id ON folio_transactions(folio_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_folio_transactions_branch ON folio_transactions(branch_id);
CREATE INDEX IF NOT EXISTS idx_folio_transactions_category ON folio_transactions(category);

-- 4. Rooms Indexes
CREATE INDEX IF NOT EXISTS idx_rooms_branch_status ON rooms(branch_id, status);
CREATE INDEX IF NOT EXISTS idx_rooms_room_number ON rooms(room_number);

-- 5. POS & Cashier Station Indexes
CREATE INDEX IF NOT EXISTS idx_orders_branch_pay_status ON orders(branch_id, payment_status, status);
CREATE INDEX IF NOT EXISTS idx_restaurant_bills_branch_pay ON restaurant_bills(branch_id, payment_status);
CREATE INDEX IF NOT EXISTS idx_bar_orders_branch_pay ON bar_orders(branch_id, payment_status);

-- 6. Guests Indexes
CREATE INDEX IF NOT EXISTS idx_guests_branch_phone ON guests(branch_id, phone);
