-- ============================================
-- HOSTEL MANAGEMENT SYSTEM - MIGRATION SCRIPT
-- Version: 2.0 to 3.0
-- ============================================
-- This script adds new guest fields for better management
-- ============================================

-- ============================================
-- STEP 1: ADD GENDER ENUM
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gender_type') THEN
    CREATE TYPE gender_type AS ENUM ('M', 'F', 'O', 'N');
  END IF;
END $$;

-- ============================================
-- STEP 2: ADD DOCUMENT TYPE ENUM
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_type') THEN
    CREATE TYPE document_type AS ENUM ('PASSPORT', 'NATIONAL_ID', 'DRIVERS_LICENSE', 'RESIDENCE_PERMIT', 'OTHER');
  END IF;
END $$;

-- ============================================
-- STEP 3: ADD NEW FIELDS TO GUESTS TABLE
-- ============================================

-- Gender field (important for dorm assignments)
ALTER TABLE guests ADD COLUMN IF NOT EXISTS gender gender_type;

-- Document type (what kind of ID was presented)
ALTER TABLE guests ADD COLUMN IF NOT EXISTS document_type document_type DEFAULT 'PASSPORT';

-- Emergency contact information
ALTER TABLE guests ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;

-- Guest notes/special requests
ALTER TABLE guests ADD COLUMN IF NOT EXISTS notes TEXT;

-- ============================================
-- STEP 4: CREATE INDEX FOR GENDER (for dorm filtering)
-- ============================================
DROP INDEX IF EXISTS idx_guests_gender;
CREATE INDEX idx_guests_gender ON guests(gender) WHERE deleted_at IS NULL;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- New fields added to guests table:
-- ✅ gender (M/F/O/N) - For dorm assignments
-- ✅ document_type - Type of ID presented
-- ✅ emergency_contact_name - Emergency contact
-- ✅ emergency_contact_phone - Emergency phone
-- ✅ notes - Special requests or notes about guest
-- ============================================
