-- Create function to handle booking check-in
CREATE OR REPLACE FUNCTION check_in_booking(
  booking_id UUID,
  user_id UUID
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_booking bookings%ROWTYPE;
  v_room rooms%ROWTYPE;
  v_result json;
BEGIN
  -- Get booking
  SELECT * INTO v_booking
  FROM bookings
  WHERE id = booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  -- Get room
  SELECT * INTO v_room
  FROM rooms
  WHERE id = v_booking.room_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found';
  END IF;

  -- Check if booking can be checked in
  IF v_booking.status != 'confirmed' THEN
    RAISE EXCEPTION 'Only confirmed bookings can be checked in';
  END IF;

  -- Check if room is available
  IF v_room.status NOT IN ('available', 'reserved') THEN
    RAISE EXCEPTION 'Room is not available for check-in';
  END IF;

  -- Start transaction
  BEGIN
    -- Update room status
    UPDATE rooms
    SET 
      status = 'occupied',
      updated_at = NOW()
    WHERE id = v_booking.room_id;

    -- Update booking status
    UPDATE bookings
    SET 
      status = 'checked_in',
      checked_in_at = NOW(),
      checked_in_by = user_id,
      updated_at = NOW()
    WHERE id = booking_id
    RETURNING to_json(*) INTO v_result;

    -- Return the updated booking
    RETURN v_result;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE EXCEPTION 'Failed to check in booking: %', SQLERRM;
  END;
END;
$$;

-- Create function to handle booking check-out
CREATE OR REPLACE FUNCTION check_out_booking(
  booking_id UUID,
  user_id UUID
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_booking bookings%ROWTYPE;
  v_room rooms%ROWTYPE;
  v_result json;
BEGIN
  -- Get booking
  SELECT * INTO v_booking
  FROM bookings
  WHERE id = booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  -- Get room
  SELECT * INTO v_room
  FROM rooms
  WHERE id = v_booking.room_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found';
  END IF;

  -- Check if booking can be checked out
  IF v_booking.status != 'checked_in' THEN
    RAISE EXCEPTION 'Only checked-in bookings can be checked out';
  END IF;

  -- Start transaction
  BEGIN
    -- Update room status
    UPDATE rooms
    SET 
      status = 'cleaning',
      updated_at = NOW()
    WHERE id = v_booking.room_id;

    -- Update booking status
    UPDATE bookings
    SET 
      status = 'checked_out',
      checked_out_at = NOW(),
      checked_out_by = user_id,
      updated_at = NOW()
    WHERE id = booking_id
    RETURNING to_json(*) INTO v_result;

    -- Return the updated booking
    RETURN v_result;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE EXCEPTION 'Failed to check out booking: %', SQLERRM;
  END;
END;
$$;
