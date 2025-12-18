-- Function to safely increment paid_amount on a booking
CREATE OR REPLACE FUNCTION increment_paid_amount(booking_id UUID, amount DECIMAL)
RETURNS VOID AS $$
BEGIN
  UPDATE bookings
  SET paid_amount = COALESCE(paid_amount, 0) + amount
  WHERE id = booking_id;
END;
$$ LANGUAGE plpgsql;
