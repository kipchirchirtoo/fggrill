-- Create booking status enum
CREATE TYPE booking_status AS ENUM (
  'pending',
  'confirmed',
  'checked_in',
  'checked_out',
  'cancelled',
  'no_show'
);

-- Create payment status enum
CREATE TYPE payment_status AS ENUM (
  'pending',
  'partial',
  'paid',
  'refunded'
);

-- Create payment method enum
CREATE TYPE payment_method AS ENUM (
  'cash',
  'card',
  'mpesa'
);

-- Create bookings table
CREATE TABLE bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  guest_id UUID REFERENCES users(id) NOT NULL,
  room_id UUID REFERENCES rooms(id) NOT NULL,
  booking_number TEXT NOT NULL UNIQUE,
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  adults INT NOT NULL DEFAULT 1,
  children INT NOT NULL DEFAULT 0,
  status booking_status DEFAULT 'pending' NOT NULL,
  payment_status payment_status DEFAULT 'pending' NOT NULL,
  payment_method payment_method,
  total_amount DECIMAL(10, 2) NOT NULL,
  paid_amount DECIMAL(10, 2) DEFAULT 0 NOT NULL,
  special_requests TEXT,
  notes TEXT,
  created_by UUID REFERENCES users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancelled_by UUID REFERENCES users(id),
  checked_in_at TIMESTAMP WITH TIME ZONE,
  checked_in_by UUID REFERENCES users(id),
  checked_out_at TIMESTAMP WITH TIME ZONE,
  checked_out_by UUID REFERENCES users(id),

  CONSTRAINT valid_dates CHECK (check_out_date > check_in_date),
  CONSTRAINT valid_adults CHECK (adults >= 1),
  CONSTRAINT valid_children CHECK (children >= 0),
  CONSTRAINT valid_amounts CHECK (paid_amount >= 0 AND paid_amount <= total_amount)
);

-- Create booking status history table
CREATE TABLE booking_status_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID REFERENCES bookings(id) NOT NULL,
  previous_status booking_status NOT NULL,
  new_status booking_status NOT NULL,
  changed_by UUID REFERENCES users(id) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create booking payments table
CREATE TABLE booking_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID REFERENCES bookings(id) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  payment_method payment_method NOT NULL,
  transaction_id TEXT,
  payment_date TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,

  CONSTRAINT valid_payment_amount CHECK (amount > 0)
);

-- Enable RLS
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_payments ENABLE ROW LEVEL SECURITY;

-- Bookings policies
CREATE POLICY "Users can view their own bookings"
  ON bookings
  FOR SELECT
  USING (auth.uid() = guest_id);

CREATE POLICY "Staff can view all bookings"
  ON bookings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'receptionist')
    )
  );

CREATE POLICY "Staff can create bookings"
  ON bookings
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'receptionist')
    )
  );

CREATE POLICY "Staff can update bookings"
  ON bookings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'receptionist')
    )
  );

-- Booking status history policies
CREATE POLICY "Users can view their own booking history"
  ON booking_status_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings 
      WHERE id = booking_id 
      AND guest_id = auth.uid()
    )
  );

CREATE POLICY "Staff can view all booking history"
  ON booking_status_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'receptionist')
    )
  );

CREATE POLICY "Staff can create booking history"
  ON booking_status_history
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'receptionist')
    )
  );

-- Booking payments policies
CREATE POLICY "Users can view their own booking payments"
  ON booking_payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings 
      WHERE id = booking_id 
      AND guest_id = auth.uid()
    )
  );

CREATE POLICY "Staff can view all booking payments"
  ON booking_payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'receptionist', 'accountant')
    )
  );

CREATE POLICY "Staff can create booking payments"
  ON booking_payments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'receptionist', 'accountant')
    )
  );

-- Create function to update booking status history
CREATE OR REPLACE FUNCTION update_booking_status_history()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status != NEW.status THEN
    INSERT INTO booking_status_history (
      booking_id,
      previous_status,
      new_status,
      changed_by
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for booking status changes
CREATE TRIGGER on_booking_status_change
  AFTER UPDATE OF status ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_booking_status_history();

-- Create function to update booking payment status
CREATE OR REPLACE FUNCTION update_booking_payment_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate total paid amount for the booking
  WITH paid_total AS (
    SELECT COALESCE(SUM(amount), 0) as total_paid
    FROM booking_payments
    WHERE booking_id = NEW.booking_id
  )
  UPDATE bookings
  SET 
    paid_amount = paid_total.total_paid,
    payment_status = CASE 
      WHEN paid_total.total_paid = 0 THEN 'pending'
      WHEN paid_total.total_paid < bookings.total_amount THEN 'partial'
      ELSE 'paid'
    END,
    updated_at = NOW()
  FROM paid_total
  WHERE id = NEW.booking_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for payment updates
CREATE TRIGGER on_booking_payment_added
  AFTER INSERT ON booking_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_booking_payment_status();
