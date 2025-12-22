-- =====================================================
-- HOSTEL SYSTEM - MÓDULO DE ÁREAS
-- Fase 1: Gestão de Áreas e Checklists
-- =====================================================

-- =====================================================
-- 1. TIPOS ENUM
-- =====================================================
DO $$ BEGIN
    CREATE TYPE area_type AS ENUM ('bedroom', 'bathroom', 'kitchen', 'common_area', 'service', 'external');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE area_status AS ENUM ('active', 'maintenance', 'inactive');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- 2. TABELA AREAS
-- =====================================================
CREATE TABLE IF NOT EXISTS areas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type area_type NOT NULL DEFAULT 'bedroom',
    description TEXT,
    location TEXT, -- Ex: "Andar 1", "Bloco A"
    floor INTEGER, -- Número do andar
    capacity INTEGER, -- Número de camas (para quartos)
    status area_status NOT NULL DEFAULT 'active',
    photo_url TEXT, -- Foto de referência do estado ideal
    cleaning_frequency TEXT DEFAULT 'on_checkout', -- 'daily', 'on_checkout', 'weekly'
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 3. TABELA AREA_CHECKLIST_ITEMS
-- =====================================================
CREATE TABLE IF NOT EXISTS area_checklist_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    area_id UUID NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    item_order INTEGER NOT NULL DEFAULT 0,
    is_required BOOLEAN NOT NULL DEFAULT true,
    category TEXT, -- 'cleaning', 'laundry', 'maintenance', 'inspection'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 4. TABELA AREA_CHECKLIST_TEMPLATES
-- Templates padrão por tipo de área
-- =====================================================
CREATE TABLE IF NOT EXISTS area_checklist_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    area_type area_type NOT NULL,
    description TEXT NOT NULL,
    item_order INTEGER NOT NULL DEFAULT 0,
    is_required BOOLEAN NOT NULL DEFAULT true,
    category TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 5. ÍNDICES PARA PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_areas_type ON areas(type);
CREATE INDEX IF NOT EXISTS idx_areas_status ON areas(status);
CREATE INDEX IF NOT EXISTS idx_areas_floor ON areas(floor);
CREATE INDEX IF NOT EXISTS idx_area_checklist_items_area_id ON area_checklist_items(area_id);
CREATE INDEX IF NOT EXISTS idx_area_checklist_items_order ON area_checklist_items(area_id, item_order);

-- =====================================================
-- 6. HABILITAR RLS
-- =====================================================
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE area_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE area_checklist_templates ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 7. POLÍTICAS RLS
-- =====================================================

-- Areas: todos autenticados podem ver
DROP POLICY IF EXISTS "Authenticated users can view areas" ON areas;
CREATE POLICY "Authenticated users can view areas" ON areas
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Areas: apenas admin/manager podem gerenciar
DROP POLICY IF EXISTS "Admin and manager can manage areas" ON areas;
CREATE POLICY "Admin and manager can manage areas" ON areas
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'manager')
        )
    );

-- Checklist items: todos autenticados podem ver
DROP POLICY IF EXISTS "Authenticated users can view checklist items" ON area_checklist_items;
CREATE POLICY "Authenticated users can view checklist items" ON area_checklist_items
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Checklist items: apenas admin/manager podem gerenciar
DROP POLICY IF EXISTS "Admin and manager can manage checklist items" ON area_checklist_items;
CREATE POLICY "Admin and manager can manage checklist items" ON area_checklist_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'manager')
        )
    );

-- Templates: todos autenticados podem ver
DROP POLICY IF EXISTS "Authenticated users can view templates" ON area_checklist_templates;
CREATE POLICY "Authenticated users can view templates" ON area_checklist_templates
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- =====================================================
-- 8. FUNÇÃO PARA ATUALIZAR updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
DROP TRIGGER IF EXISTS update_areas_updated_at ON areas;
CREATE TRIGGER update_areas_updated_at
    BEFORE UPDATE ON areas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_area_checklist_items_updated_at ON area_checklist_items;
CREATE TRIGGER update_area_checklist_items_updated_at
    BEFORE UPDATE ON area_checklist_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 9. FUNÇÃO PARA COPIAR TEMPLATE PARA NOVA ÁREA
-- =====================================================
CREATE OR REPLACE FUNCTION copy_checklist_template_to_area(p_area_id UUID, p_area_type area_type)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER := 0;
BEGIN
    INSERT INTO area_checklist_items (area_id, description, item_order, is_required, category)
    SELECT
        p_area_id,
        description,
        item_order,
        is_required,
        category
    FROM area_checklist_templates
    WHERE area_type = p_area_type;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 10. TEMPLATES PADRÃO POR TIPO DE ÁREA
-- =====================================================

-- Limpar templates existentes para evitar duplicatas
DELETE FROM area_checklist_templates;

-- Templates para QUARTOS
INSERT INTO area_checklist_templates (area_type, description, item_order, is_required, category) VALUES
('bedroom', 'Trocar lençóis', 1, true, 'laundry'),
('bedroom', 'Trocar fronhas', 2, true, 'laundry'),
('bedroom', 'Trocar toalhas', 3, true, 'laundry'),
('bedroom', 'Esvaziar lixeira', 4, true, 'cleaning'),
('bedroom', 'Limpar piso', 5, true, 'cleaning'),
('bedroom', 'Limpar superfícies', 6, true, 'cleaning'),
('bedroom', 'Verificar janelas', 7, false, 'inspection'),
('bedroom', 'Verificar ar condicionado', 8, false, 'inspection'),
('bedroom', 'Verificar lâmpadas', 9, false, 'inspection');

-- Templates para BANHEIROS
INSERT INTO area_checklist_templates (area_type, description, item_order, is_required, category) VALUES
('bathroom', 'Limpar vaso sanitário', 1, true, 'cleaning'),
('bathroom', 'Limpar pia', 2, true, 'cleaning'),
('bathroom', 'Limpar box/chuveiro', 3, true, 'cleaning'),
('bathroom', 'Limpar espelho', 4, true, 'cleaning'),
('bathroom', 'Limpar piso', 5, true, 'cleaning'),
('bathroom', 'Repor papel higiênico', 6, true, 'cleaning'),
('bathroom', 'Repor sabonete', 7, true, 'cleaning'),
('bathroom', 'Esvaziar lixeira', 8, true, 'cleaning'),
('bathroom', 'Verificar vazamentos', 9, false, 'inspection');

-- Templates para COZINHA
INSERT INTO area_checklist_templates (area_type, description, item_order, is_required, category) VALUES
('kitchen', 'Limpar fogão', 1, true, 'cleaning'),
('kitchen', 'Limpar pia', 2, true, 'cleaning'),
('kitchen', 'Limpar bancadas', 3, true, 'cleaning'),
('kitchen', 'Organizar geladeira', 4, true, 'cleaning'),
('kitchen', 'Lavar louças', 5, true, 'cleaning'),
('kitchen', 'Limpar piso', 6, true, 'cleaning'),
('kitchen', 'Retirar lixo', 7, true, 'cleaning'),
('kitchen', 'Verificar validade dos alimentos', 8, false, 'inspection');

-- Templates para ÁREAS COMUNS
INSERT INTO area_checklist_templates (area_type, description, item_order, is_required, category) VALUES
('common_area', 'Limpar piso', 1, true, 'cleaning'),
('common_area', 'Limpar mesas', 2, true, 'cleaning'),
('common_area', 'Organizar sofás/cadeiras', 3, true, 'cleaning'),
('common_area', 'Esvaziar lixeiras', 4, true, 'cleaning'),
('common_area', 'Limpar janelas', 5, false, 'cleaning'),
('common_area', 'Verificar iluminação', 6, false, 'inspection');

-- Templates para ÁREAS DE SERVIÇO
INSERT INTO area_checklist_templates (area_type, description, item_order, is_required, category) VALUES
('service', 'Organizar materiais', 1, true, 'cleaning'),
('service', 'Verificar estoque de limpeza', 2, true, 'inspection'),
('service', 'Limpar piso', 3, true, 'cleaning'),
('service', 'Verificar equipamentos', 4, false, 'inspection');

-- Templates para ÁREAS EXTERNAS
INSERT INTO area_checklist_templates (area_type, description, item_order, is_required, category) VALUES
('external', 'Varrer área', 1, true, 'cleaning'),
('external', 'Recolher lixo', 2, true, 'cleaning'),
('external', 'Regar plantas', 3, false, 'maintenance'),
('external', 'Verificar iluminação externa', 4, false, 'inspection');

-- =====================================================
-- 11. GRANT PERMISSIONS
-- =====================================================
GRANT EXECUTE ON FUNCTION copy_checklist_template_to_area(UUID, area_type) TO authenticated;

-- =====================================================
-- FIM DA MIGRAÇÃO
-- =====================================================
