-- =====================================================
-- HOSTEL SYSTEM - MÓDULO DE OPERAÇÕES
-- Migração para adicionar gestão de tarefas, usuários e permissões
-- =====================================================

-- =====================================================
-- 1. TABELA PROFILES (Perfis de Usuário)
-- =====================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'employee', 'volunteer')) DEFAULT 'employee',
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON profiles(is_active);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_profiles_updated_at();

-- =====================================================
-- 2. TABELA ROLE_PERMISSIONS (Permissões Customizáveis)
-- =====================================================
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'employee', 'volunteer')),
  module TEXT NOT NULL,
  can_view BOOLEAN DEFAULT false,
  can_create BOOLEAN DEFAULT false,
  can_edit BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role, module)
);

-- Índice
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS role_permissions_updated_at ON role_permissions;
CREATE TRIGGER role_permissions_updated_at
  BEFORE UPDATE ON role_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_profiles_updated_at();

-- Inserir permissões padrão
INSERT INTO role_permissions (role, module, can_view, can_create, can_edit, can_delete) VALUES
  -- Admin: acesso total
  ('admin', 'dashboard', true, true, true, true),
  ('admin', 'calendar', true, true, true, true),
  ('admin', 'bookings', true, true, true, true),
  ('admin', 'guests', true, true, true, true),
  ('admin', 'rooms', true, true, true, true),
  ('admin', 'finance', true, true, true, true),
  ('admin', 'tasks', true, true, true, true),
  ('admin', 'laundry', true, true, true, true),
  ('admin', 'areas', true, true, true, true),
  ('admin', 'checklists', true, true, true, true),
  ('admin', 'users', true, true, true, true),
  ('admin', 'permissions', true, true, true, true),
  ('admin', 'settings', true, true, true, true),

  -- Manager: quase tudo, sem usuários e permissões
  ('manager', 'dashboard', true, true, true, true),
  ('manager', 'calendar', true, true, true, true),
  ('manager', 'bookings', true, true, true, false),
  ('manager', 'guests', true, true, true, false),
  ('manager', 'rooms', true, true, true, false),
  ('manager', 'finance', true, false, false, false),
  ('manager', 'tasks', true, true, true, true),
  ('manager', 'laundry', true, true, true, false),
  ('manager', 'areas', true, true, true, false),
  ('manager', 'checklists', true, true, true, false),
  ('manager', 'users', false, false, false, false),
  ('manager', 'permissions', false, false, false, false),
  ('manager', 'settings', false, false, false, false),

  -- Employee: operacional básico
  ('employee', 'dashboard', true, false, false, false),
  ('employee', 'calendar', true, false, false, false),
  ('employee', 'bookings', true, false, false, false),
  ('employee', 'guests', true, false, false, false),
  ('employee', 'rooms', true, false, false, false),
  ('employee', 'finance', false, false, false, false),
  ('employee', 'tasks', true, false, true, false),
  ('employee', 'laundry', true, true, true, false),
  ('employee', 'areas', true, false, false, false),
  ('employee', 'checklists', true, false, false, false),
  ('employee', 'users', false, false, false, false),
  ('employee', 'permissions', false, false, false, false),
  ('employee', 'settings', false, false, false, false),

  -- Volunteer: apenas suas tarefas
  ('volunteer', 'dashboard', true, false, false, false),
  ('volunteer', 'calendar', false, false, false, false),
  ('volunteer', 'bookings', false, false, false, false),
  ('volunteer', 'guests', false, false, false, false),
  ('volunteer', 'rooms', false, false, false, false),
  ('volunteer', 'finance', false, false, false, false),
  ('volunteer', 'tasks', true, false, true, false),
  ('volunteer', 'laundry', false, false, false, false),
  ('volunteer', 'areas', true, false, false, false),
  ('volunteer', 'checklists', true, false, false, false),
  ('volunteer', 'users', false, false, false, false),
  ('volunteer', 'permissions', false, false, false, false),
  ('volunteer', 'settings', false, false, false, false)
ON CONFLICT (role, module) DO NOTHING;

-- =====================================================
-- 3. TABELA AREAS (Áreas do Hostel)
-- =====================================================
CREATE TABLE IF NOT EXISTS areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('room', 'bathroom', 'common', 'service', 'external')),
  floor TEXT,
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  cleaning_frequency TEXT CHECK (cleaning_frequency IN ('daily', 'checkout', 'weekly', 'monthly')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_areas_type ON areas(type);
CREATE INDEX IF NOT EXISTS idx_areas_room_id ON areas(room_id);
CREATE INDEX IF NOT EXISTS idx_areas_is_active ON areas(is_active);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS areas_updated_at ON areas;
CREATE TRIGGER areas_updated_at
  BEFORE UPDATE ON areas
  FOR EACH ROW
  EXECUTE FUNCTION update_profiles_updated_at();

-- =====================================================
-- 4. TABELA CHECKLIST_TEMPLATES (Templates de Checklist)
-- =====================================================
CREATE TABLE IF NOT EXISTS checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  area_type TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice
CREATE INDEX IF NOT EXISTS idx_checklist_templates_area_type ON checklist_templates(area_type);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS checklist_templates_updated_at ON checklist_templates;
CREATE TRIGGER checklist_templates_updated_at
  BEFORE UPDATE ON checklist_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_profiles_updated_at();

-- Inserir templates padrão
INSERT INTO checklist_templates (name, area_type, items) VALUES
  ('Limpeza de Quarto', 'room', '[
    {"id": 1, "text": "Retirar roupa de cama suja", "required": true},
    {"id": 2, "text": "Limpar superfícies e móveis", "required": true},
    {"id": 3, "text": "Varrer o chão", "required": true},
    {"id": 4, "text": "Passar pano úmido no chão", "required": true},
    {"id": 5, "text": "Colocar roupa de cama limpa", "required": true},
    {"id": 6, "text": "Verificar lâmpadas", "required": false},
    {"id": 7, "text": "Verificar tomadas e interruptores", "required": false},
    {"id": 8, "text": "Repor amenities (se aplicável)", "required": false}
  ]'::jsonb),
  ('Limpeza de Banheiro', 'bathroom', '[
    {"id": 1, "text": "Limpar vaso sanitário", "required": true},
    {"id": 2, "text": "Limpar pia e espelho", "required": true},
    {"id": 3, "text": "Limpar box/chuveiro", "required": true},
    {"id": 4, "text": "Limpar piso", "required": true},
    {"id": 5, "text": "Repor papel higiênico", "required": true},
    {"id": 6, "text": "Repor sabonete", "required": true},
    {"id": 7, "text": "Verificar ralos", "required": false}
  ]'::jsonb),
  ('Limpeza de Cozinha', 'common', '[
    {"id": 1, "text": "Lavar louça suja", "required": true},
    {"id": 2, "text": "Limpar fogão", "required": true},
    {"id": 3, "text": "Limpar bancadas", "required": true},
    {"id": 4, "text": "Limpar pia", "required": true},
    {"id": 5, "text": "Varrer e passar pano no chão", "required": true},
    {"id": 6, "text": "Verificar geladeira", "required": false},
    {"id": 7, "text": "Retirar lixo", "required": true}
  ]'::jsonb),
  ('Limpeza Área Comum', 'common', '[
    {"id": 1, "text": "Organizar sofás e almofadas", "required": true},
    {"id": 2, "text": "Limpar mesas", "required": true},
    {"id": 3, "text": "Varrer o chão", "required": true},
    {"id": 4, "text": "Passar pano no chão", "required": true},
    {"id": 5, "text": "Limpar janelas (se necessário)", "required": false},
    {"id": 6, "text": "Retirar lixo", "required": true}
  ]'::jsonb);

-- =====================================================
-- 5. TABELA TASKS (Tarefas)
-- =====================================================
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  area_id UUID REFERENCES areas(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('checkout', 'daily', 'weekly', 'manual', 'urgent')) DEFAULT 'manual',
  priority TEXT NOT NULL CHECK (priority IN ('low', 'normal', 'high', 'urgent')) DEFAULT 'normal',
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  due_date DATE NOT NULL,
  due_time TIME,
  checklist_items JSONB DEFAULT '[]',
  status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')) DEFAULT 'pending',
  photo_before TEXT,
  photo_after TEXT,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(type);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_area_id ON tasks(area_id);
CREATE INDEX IF NOT EXISTS idx_tasks_booking_id ON tasks(booking_id);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS tasks_updated_at ON tasks;
CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_profiles_updated_at();

-- =====================================================
-- 6. TABELA LAUNDRY_ITEMS (Itens de Lavanderia)
-- =====================================================
CREATE TABLE IF NOT EXISTS laundry_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('sheet', 'pillowcase', 'towel', 'blanket', 'duvet', 'other')),
  clean_count INTEGER DEFAULT 0,
  dirty_count INTEGER DEFAULT 0,
  in_wash_count INTEGER DEFAULT 0,
  min_stock INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice
CREATE INDEX IF NOT EXISTS idx_laundry_items_type ON laundry_items(type);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS laundry_items_updated_at ON laundry_items;
CREATE TRIGGER laundry_items_updated_at
  BEFORE UPDATE ON laundry_items
  FOR EACH ROW
  EXECUTE FUNCTION update_profiles_updated_at();

-- Inserir itens padrão
INSERT INTO laundry_items (name, type, clean_count, min_stock) VALUES
  ('Lençol Solteiro', 'sheet', 50, 20),
  ('Lençol Casal', 'sheet', 20, 10),
  ('Fronha', 'pillowcase', 80, 30),
  ('Toalha de Banho', 'towel', 60, 25),
  ('Toalha de Rosto', 'towel', 40, 20),
  ('Cobertor Solteiro', 'blanket', 30, 10),
  ('Cobertor Casal', 'blanket', 15, 5),
  ('Edredom Solteiro', 'duvet', 20, 8),
  ('Edredom Casal', 'duvet', 10, 4);

-- =====================================================
-- 7. TABELA LAUNDRY_CYCLES (Ciclos de Lavagem)
-- =====================================================
CREATE TABLE IF NOT EXISTS laundry_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  items JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL CHECK (status IN ('washing', 'drying', 'ready', 'stored')) DEFAULT 'washing',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- Índice
CREATE INDEX IF NOT EXISTS idx_laundry_cycles_status ON laundry_cycles(status);
CREATE INDEX IF NOT EXISTS idx_laundry_cycles_started_at ON laundry_cycles(started_at);

-- =====================================================
-- 8. TABELA ACTIVITY_LOG (Log de Atividades)
-- =====================================================
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON activity_log(entity);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at);

-- =====================================================
-- 9. POLÍTICAS RLS (Row Level Security)
-- =====================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE laundry_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE laundry_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- PROFILES: Simple policies without recursion
-- ⚠️ IMPORTANT: Do NOT query the profiles table in policies for the profiles table (causes infinite recursion)
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON profiles;
CREATE POLICY "Authenticated users can view all profiles" ON profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can delete own profile" ON profiles;
CREATE POLICY "Users can delete own profile" ON profiles
  FOR DELETE USING (auth.uid() = id);

-- NOTE: Removed "Admin can manage all profiles" policy as it caused infinite recursion
-- The policy was querying the profiles table within its own policy check
-- For admin-only operations, handle permissions at the application level or use auth.jwt() claims

-- ROLE_PERMISSIONS: apenas admin pode modificar
DROP POLICY IF EXISTS "Anyone can view permissions" ON role_permissions;
CREATE POLICY "Anyone can view permissions" ON role_permissions
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admin can manage permissions" ON role_permissions;
CREATE POLICY "Admin can manage permissions" ON role_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
    )
  );

-- AREAS: todos autenticados podem ver, admin/manager podem modificar
DROP POLICY IF EXISTS "Authenticated can view areas" ON areas;
CREATE POLICY "Authenticated can view areas" ON areas
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admin/Manager can manage areas" ON areas;
CREATE POLICY "Admin/Manager can manage areas" ON areas
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'manager')
    )
  );

-- CHECKLIST_TEMPLATES: todos podem ver, admin/manager podem modificar
DROP POLICY IF EXISTS "Authenticated can view templates" ON checklist_templates;
CREATE POLICY "Authenticated can view templates" ON checklist_templates
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admin/Manager can manage templates" ON checklist_templates;
CREATE POLICY "Admin/Manager can manage templates" ON checklist_templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'manager')
    )
  );

-- TASKS: lógica especial para voluntários (apenas suas tarefas)
DROP POLICY IF EXISTS "View tasks based on role" ON tasks;
CREATE POLICY "View tasks based on role" ON tasks
  FOR SELECT USING (
    -- Admin/Manager veem tudo
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'manager')
    )
    OR
    -- Employee/Volunteer veem apenas suas tarefas
    assigned_to = auth.uid()
  );

DROP POLICY IF EXISTS "Manage tasks based on role" ON tasks;
CREATE POLICY "Manage tasks based on role" ON tasks
  FOR ALL USING (
    -- Admin/Manager podem fazer tudo
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'manager')
    )
    OR
    -- Employee/Volunteer podem editar apenas suas tarefas (marcar como concluído)
    (assigned_to = auth.uid() AND status != 'cancelled')
  );

-- LAUNDRY_ITEMS: admin/manager/employee podem ver e modificar
DROP POLICY IF EXISTS "View laundry items" ON laundry_items;
CREATE POLICY "View laundry items" ON laundry_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'manager', 'employee')
    )
  );

DROP POLICY IF EXISTS "Manage laundry items" ON laundry_items;
CREATE POLICY "Manage laundry items" ON laundry_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'manager', 'employee')
    )
  );

-- LAUNDRY_CYCLES: admin/manager/employee podem ver e modificar
DROP POLICY IF EXISTS "View laundry cycles" ON laundry_cycles;
CREATE POLICY "View laundry cycles" ON laundry_cycles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'manager', 'employee')
    )
  );

DROP POLICY IF EXISTS "Manage laundry cycles" ON laundry_cycles;
CREATE POLICY "Manage laundry cycles" ON laundry_cycles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'manager', 'employee')
    )
  );

-- ACTIVITY_LOG: apenas admin pode ver, sistema pode inserir
DROP POLICY IF EXISTS "Admin can view activity log" ON activity_log;
CREATE POLICY "Admin can view activity log" ON activity_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Authenticated can insert activity log" ON activity_log;
CREATE POLICY "Authenticated can insert activity log" ON activity_log
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- =====================================================
-- 10. FUNÇÃO PARA CRIAR PROFILE AUTOMATICAMENTE
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'employee')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para criar profile quando usuário é criado
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- FIM DA MIGRAÇÃO
-- =====================================================
