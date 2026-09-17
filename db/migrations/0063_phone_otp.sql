-- 0063_phone_otp.sql — one-time codes for phone verification.
-- A short-lived code per phone; confirming it flips person.verified_at. Delivery
-- goes through the swappable OTP adapter (stub by default), so this table works in
-- dev/tests and is ready for a real SMS/WhatsApp provider without schema changes.
CREATE TABLE IF NOT EXISTS phone_otp (
  phone_e164 text PRIMARY KEY,
  code       text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
