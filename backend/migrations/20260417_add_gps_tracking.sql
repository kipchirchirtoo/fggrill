-- Migration: Add GPS Tracking for Dispatches
-- Description: Adds location tracking tables and columns for real-time dispatch monitoring
-- Date: 2026-04-17

-- =====================================================
-- 1. ADD LOCATION COLUMNS TO STORE_DISPATCHES
-- =====================================================

DO $$ 
BEGIN
  -- Add last_location_lat column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'store_dispatches' 
    AND column_name = 'last_location_lat'
  ) THEN
    ALTER TABLE store_dispatches 
    ADD COLUMN last_location_lat DECIMAL(10, 8);
  END IF;

  -- Add last_location_lng column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'store_dispatches' 
    AND column_name = 'last_location_lng'
  ) THEN
    ALTER TABLE store_dispatches 
    ADD COLUMN last_location_lng DECIMAL(11, 8);
  END IF;

  -- Add last_location_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'store_dispatches' 
    AND column_name = 'last_location_at'
  ) THEN
    ALTER TABLE store_dispatches 
    ADD COLUMN last_location_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- =====================================================
-- 2. CREATE DISPATCH_TRACKING TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS dispatch_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id UUID REFERENCES store_dispatches(id) ON DELETE CASCADE NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy DECIMAL(10, 2), -- GPS accuracy in meters
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  recorded_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  
  -- Constraints
  CONSTRAINT valid_latitude CHECK (latitude >= -90 AND latitude <= 90),
  CONSTRAINT valid_longitude CHECK (longitude >= -180 AND longitude <= 180),
  CONSTRAINT valid_accuracy CHECK (accuracy IS NULL OR accuracy >= 0)
);

-- =====================================================
-- 3. CREATE INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_dispatch_tracking_dispatch ON dispatch_tracking(dispatch_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_tracking_recorded_at ON dispatch_tracking(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_store_dispatches_location ON store_dispatches(last_location_lat, last_location_lng) 
  WHERE last_location_lat IS NOT NULL AND last_location_lng IS NOT NULL;

-- =====================================================
-- 4. CREATE FUNCTION TO GET DISTANCE BETWEEN TWO POINTS
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_distance(
  lat1 DECIMAL,
  lon1 DECIMAL,
  lat2 DECIMAL,
  lon2 DECIMAL
)
RETURNS DECIMAL AS $$
DECLARE
  earth_radius DECIMAL := 6371; -- Earth radius in kilometers
  dlat DECIMAL;
  dlon DECIMAL;
  a DECIMAL;
  c DECIMAL;
BEGIN
  -- Haversine formula
  dlat := RADIANS(lat2 - lat1);
  dlon := RADIANS(lon2 - lon1);
  
  a := SIN(dlat/2) * SIN(dlat/2) + 
       COS(RADIANS(lat1)) * COS(RADIANS(lat2)) * 
       SIN(dlon/2) * SIN(dlon/2);
  
  c := 2 * ATAN2(SQRT(a), SQRT(1-a));
  
  RETURN earth_radius * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- 5. COMMENTS
-- =====================================================

COMMENT ON TABLE dispatch_tracking IS 'GPS location tracking history for dispatches';
COMMENT ON COLUMN dispatch_tracking.latitude IS 'GPS latitude coordinate (-90 to 90)';
COMMENT ON COLUMN dispatch_tracking.longitude IS 'GPS longitude coordinate (-180 to 180)';
COMMENT ON COLUMN dispatch_tracking.accuracy IS 'GPS accuracy in meters';
COMMENT ON COLUMN store_dispatches.last_location_lat IS 'Last known latitude of dispatch';
COMMENT ON COLUMN store_dispatches.last_location_lng IS 'Last known longitude of dispatch';
COMMENT ON COLUMN store_dispatches.last_location_at IS 'Timestamp of last location update';
COMMENT ON FUNCTION calculate_distance IS 'Calculate distance in kilometers between two GPS coordinates using Haversine formula';

-- =====================================================
-- 6. GRANT PERMISSIONS
-- =====================================================

GRANT SELECT, INSERT ON dispatch_tracking TO authenticated;
GRANT SELECT ON store_dispatches TO authenticated;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
