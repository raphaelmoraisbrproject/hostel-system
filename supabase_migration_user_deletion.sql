-- =====================================================
-- HOSTEL SYSTEM - ADMIN USER DELETION MODULE
-- Migration to add admin user deletion/deactivation
-- =====================================================

-- =====================================================
-- 1. FUNCTION: delete_user_profile
-- Allows admins to deactivate or delete user profiles
-- =====================================================

CREATE OR REPLACE FUNCTION public.delete_user_profile(
  p_user_id UUID,
  p_hard_delete BOOLEAN DEFAULT FALSE
)
RETURNS JSONB AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
  v_target_role TEXT;
  v_target_name TEXT;
  v_result JSONB;
BEGIN
  -- Get the caller's ID
  v_caller_id := auth.uid();

  -- Check if caller is authenticated
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Not authenticated'
    );
  END IF;

  -- Prevent self-deletion
  IF v_caller_id = p_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot delete your own account'
    );
  END IF;

  -- Get caller's role
  SELECT role INTO v_caller_role
  FROM profiles
  WHERE id = v_caller_id;

  -- Check if caller is admin
  IF v_caller_role != 'admin' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only administrators can delete users'
    );
  END IF;

  -- Get target user info
  SELECT role, full_name INTO v_target_role, v_target_name
  FROM profiles
  WHERE id = p_user_id;

  -- Check if target user exists
  IF v_target_role IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;

  -- Perform deletion or deactivation
  IF p_hard_delete THEN
    -- Hard delete: Remove from profiles table
    DELETE FROM profiles WHERE id = p_user_id;

    v_result := jsonb_build_object(
      'success', true,
      'action', 'deleted',
      'user_id', p_user_id,
      'user_name', v_target_name,
      'message', 'User profile deleted successfully'
    );
  ELSE
    -- Soft delete: Mark as inactive
    UPDATE profiles
    SET
      is_active = false,
      updated_at = NOW()
    WHERE id = p_user_id;

    v_result := jsonb_build_object(
      'success', true,
      'action', 'deactivated',
      'user_id', p_user_id,
      'user_name', v_target_name,
      'message', 'User deactivated successfully'
    );
  END IF;

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 2. FUNCTION: reactivate_user_profile
-- Allows admins to reactivate deactivated users
-- =====================================================

CREATE OR REPLACE FUNCTION public.reactivate_user_profile(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
  v_target_name TEXT;
  v_current_status BOOLEAN;
BEGIN
  -- Get the caller's ID
  v_caller_id := auth.uid();

  -- Check if caller is authenticated
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Not authenticated'
    );
  END IF;

  -- Get caller's role
  SELECT role INTO v_caller_role
  FROM profiles
  WHERE id = v_caller_id;

  -- Check if caller is admin
  IF v_caller_role != 'admin' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only administrators can reactivate users'
    );
  END IF;

  -- Get target user info
  SELECT full_name, is_active INTO v_target_name, v_current_status
  FROM profiles
  WHERE id = p_user_id;

  -- Check if target user exists
  IF v_target_name IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;

  -- Check if already active
  IF v_current_status = true THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User is already active'
    );
  END IF;

  -- Reactivate user
  UPDATE profiles
  SET
    is_active = true,
    updated_at = NOW()
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'action', 'reactivated',
    'user_id', p_user_id,
    'user_name', v_target_name,
    'message', 'User reactivated successfully'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 3. GRANT EXECUTE PERMISSIONS
-- =====================================================

GRANT EXECUTE ON FUNCTION public.delete_user_profile(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reactivate_user_profile(UUID) TO authenticated;

-- =====================================================
-- END OF MIGRATION
-- =====================================================
