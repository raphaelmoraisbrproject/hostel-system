-- ============================================
-- PHASE 2: Tasks System Migration
-- ============================================

-- Task status enum
CREATE TYPE task_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');

-- Task type enum
CREATE TYPE task_type AS ENUM ('checkout', 'cleaning', 'maintenance', 'inspection', 'custom');

-- Task priority enum
CREATE TYPE task_priority AS ENUM ('low', 'normal', 'high', 'urgent');

-- ============================================
-- Tasks table
-- ============================================
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  area_id UUID REFERENCES areas(id) ON DELETE CASCADE,
  bed_id UUID REFERENCES beds(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Task info
  title VARCHAR(255) NOT NULL,
  description TEXT,
  task_type task_type NOT NULL DEFAULT 'cleaning',
  status task_status NOT NULL DEFAULT 'pending',
  priority task_priority NOT NULL DEFAULT 'normal',

  -- Dates
  due_date DATE,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Task checklist progress (tracks completion of area checklist items per task)
-- ============================================
CREATE TABLE task_checklist_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  checklist_item_id UUID NOT NULL REFERENCES area_checklist_items(id) ON DELETE CASCADE,

  is_completed BOOLEAN DEFAULT FALSE,
  completed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(task_id, checklist_item_id)
);

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX idx_tasks_area_id ON tasks(area_id);
CREATE INDEX idx_tasks_bed_id ON tasks(bed_id);
CREATE INDEX idx_tasks_booking_id ON tasks(booking_id);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_task_type ON tasks(task_type);
CREATE INDEX idx_task_checklist_progress_task_id ON task_checklist_progress(task_id);

-- ============================================
-- Triggers
-- ============================================
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- RLS Policies
-- ============================================
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_checklist_progress ENABLE ROW LEVEL SECURITY;

-- Tasks: All authenticated users can view
CREATE POLICY "tasks_select_policy" ON tasks
  FOR SELECT TO authenticated USING (true);

-- Tasks: Authenticated users can insert
CREATE POLICY "tasks_insert_policy" ON tasks
  FOR INSERT TO authenticated WITH CHECK (true);

-- Tasks: Users can update tasks assigned to them or admins/managers can update any
CREATE POLICY "tasks_update_policy" ON tasks
  FOR UPDATE TO authenticated USING (true);

-- Tasks: Only admins/managers can delete
CREATE POLICY "tasks_delete_policy" ON tasks
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  );

-- Task checklist progress: All authenticated users can view
CREATE POLICY "task_checklist_progress_select_policy" ON task_checklist_progress
  FOR SELECT TO authenticated USING (true);

-- Task checklist progress: Authenticated users can insert/update
CREATE POLICY "task_checklist_progress_insert_policy" ON task_checklist_progress
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "task_checklist_progress_update_policy" ON task_checklist_progress
  FOR UPDATE TO authenticated USING (true);

-- ============================================
-- Function to create checkout task
-- ============================================
CREATE OR REPLACE FUNCTION create_checkout_task(
  p_booking_id UUID,
  p_area_id UUID,
  p_bed_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_task_id UUID;
  v_room_name TEXT;
  v_bed_number TEXT;
  v_title TEXT;
  v_room_type TEXT;
BEGIN
  -- Get room info
  SELECT r.name, r.type INTO v_room_name, v_room_type
  FROM areas a
  JOIN rooms r ON a.room_id = r.id
  WHERE a.id = p_area_id;

  -- Get bed number if provided
  IF p_bed_id IS NOT NULL THEN
    SELECT bed_number INTO v_bed_number FROM beds WHERE id = p_bed_id;
  END IF;

  -- Build title based on room type
  IF v_room_type = 'Dorm' AND v_bed_number IS NOT NULL THEN
    v_title := 'Trocar roupa de cama - Cama ' || v_bed_number;
  ELSE
    v_title := 'Limpar quarto completo';
  END IF;

  -- Create the task
  INSERT INTO tasks (
    area_id,
    bed_id,
    booking_id,
    title,
    task_type,
    status,
    priority,
    due_date
  ) VALUES (
    p_area_id,
    p_bed_id,
    p_booking_id,
    v_title,
    'checkout',
    'pending',
    'high',
    CURRENT_DATE
  ) RETURNING id INTO v_task_id;

  -- Copy checklist items from area to task progress
  INSERT INTO task_checklist_progress (task_id, checklist_item_id)
  SELECT v_task_id, id
  FROM area_checklist_items
  WHERE area_id = p_area_id;

  RETURN v_task_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Function to complete a task
-- ============================================
CREATE OR REPLACE FUNCTION complete_task(p_task_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_required_incomplete INT;
BEGIN
  -- Check if all required checklist items are completed
  SELECT COUNT(*) INTO v_required_incomplete
  FROM task_checklist_progress tcp
  JOIN area_checklist_items aci ON tcp.checklist_item_id = aci.id
  WHERE tcp.task_id = p_task_id
    AND aci.is_required = true
    AND tcp.is_completed = false;

  IF v_required_incomplete > 0 THEN
    RAISE EXCEPTION 'Cannot complete task: % required checklist items are incomplete', v_required_incomplete;
  END IF;

  -- Mark task as completed
  UPDATE tasks
  SET status = 'completed',
      completed_at = NOW()
  WHERE id = p_task_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
