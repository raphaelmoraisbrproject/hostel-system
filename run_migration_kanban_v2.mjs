import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Read .env file manually
const envContent = readFileSync('.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    env[key.trim()] = valueParts.join('=').trim();
  }
});

const supabase = createClient(
  env.VITE_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY
);

const migration = `
-- =====================================================
-- KANBAN V2 MIGRATION
-- =====================================================

-- 1. Add auto_checkout_task to areas table
ALTER TABLE areas
ADD COLUMN IF NOT EXISTS auto_checkout_task BOOLEAN DEFAULT true;

-- 2. Add category field to tasks table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'category'
  ) THEN
    ALTER TABLE tasks ADD COLUMN category TEXT DEFAULT 'geral';

    ALTER TABLE tasks ADD CONSTRAINT tasks_category_check
    CHECK (category IN ('limpeza', 'lavanderia', 'manutencao', 'geral'));
  END IF;
END $$;

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_areas_auto_checkout_task
ON areas(auto_checkout_task) WHERE auto_checkout_task = true;

CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category);

-- 4. Set default auto_checkout_task = true for existing room-type areas
UPDATE areas SET auto_checkout_task = true WHERE type = 'room' AND auto_checkout_task IS NULL;

-- 5. Set category = 'limpeza' for existing checkout tasks
UPDATE tasks SET category = 'limpeza' WHERE type = 'checkout' AND (category IS NULL OR category = 'geral');

-- 6. Updated function to create checkout task with category and toggle check
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
  v_assigned_to UUID;
  v_checklist JSONB;
  v_auto_checkout BOOLEAN;
BEGIN
  -- Check if auto_checkout_task is enabled for this area
  SELECT auto_checkout_task INTO v_auto_checkout
  FROM areas WHERE id = p_area_id;

  -- If auto_checkout_task is disabled, return NULL (no task created)
  IF v_auto_checkout = false THEN
    RETURN NULL;
  END IF;

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
    v_title := 'Limpeza check-out - Cama ' || v_bed_number;
  ELSE
    v_title := 'Limpeza check-out - ' || COALESCE(v_room_name, 'Quarto');
  END IF;

  -- Find available staff (employee or manager)
  SELECT id INTO v_assigned_to
  FROM profiles
  WHERE is_active = true
    AND role IN ('employee', 'manager')
  ORDER BY role DESC, full_name
  LIMIT 1;

  -- Fallback to admin if no staff available
  IF v_assigned_to IS NULL THEN
    SELECT id INTO v_assigned_to
    FROM profiles
    WHERE is_active = true
      AND role = 'admin'
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  -- Build default checklist items
  v_checklist := '[
    {"text": "Trocar lencois e fronhas", "done": false},
    {"text": "Limpeza do piso", "done": false}
  ]'::jsonb;

  -- Create the task with category 'limpeza'
  INSERT INTO tasks (
    area_id,
    bed_id,
    booking_id,
    title,
    type,
    category,
    status,
    priority,
    due_date,
    assigned_to,
    checklist_items
  ) VALUES (
    p_area_id,
    p_bed_id,
    p_booking_id,
    v_title,
    'checkout',
    'limpeza',
    'pending',
    'high',
    CURRENT_DATE,
    v_assigned_to,
    v_checklist
  ) RETURNING id INTO v_task_id;

  RETURN v_task_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;

async function runMigration() {
  console.log('Running Kanban V2 migration...');
  console.log('SQL to be executed:');
  console.log(migration);
  console.log('\n---\n');

  // Try using Supabase Management API
  const projectRef = env.VITE_SUPABASE_URL.match(/https:\/\/([^.]+)/)?.[1];

  if (env.SUPABASE_ACCESS_TOKEN && projectRef) {
    console.log('Using Supabase Management API...');

    const response = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.SUPABASE_ACCESS_TOKEN}`
        },
        body: JSON.stringify({ query: migration })
      }
    );

    if (response.ok) {
      const result = await response.json();
      console.log('Migration completed successfully!');
      console.log('Result:', JSON.stringify(result, null, 2));
      return;
    } else {
      const errorText = await response.text();
      console.error('API Error:', errorText);
    }
  }

  console.log('\nPlease run the SQL above manually in the Supabase SQL Editor.');
}

runMigration().catch(console.error);
