-- Migration: Settings Table
-- Cria tabela de configurações globais do sistema
-- Preparada para multi-tenant futuro (organization_id)

-- Criar tabela settings
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  organization_id UUID DEFAULT NULL,  -- NULL = global, futuro: ID da organização
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(key, organization_id)  -- Permite mesmo key por organização
);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS settings_updated_at ON settings;
CREATE TRIGGER settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW
  EXECUTE FUNCTION update_settings_updated_at();

-- Habilitar RLS
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Política: todos podem ler settings globais
CREATE POLICY "Anyone can read global settings" ON settings
  FOR SELECT USING (organization_id IS NULL);

-- Política: usuários autenticados podem atualizar settings globais
CREATE POLICY "Authenticated users can update global settings" ON settings
  FOR UPDATE USING (organization_id IS NULL);

-- Política: usuários autenticados podem inserir settings
CREATE POLICY "Authenticated users can insert settings" ON settings
  FOR INSERT WITH CHECK (true);

-- Inserir configuração padrão de moeda (se não existir)
INSERT INTO settings (key, value)
VALUES (
  'currency',
  '{"code": "BRL", "symbol": "R$", "locale": "pt-BR", "name": "Real Brasileiro", "flag": "🇧🇷", "decimalPlaces": 2}'::jsonb
)
ON CONFLICT (key, organization_id) DO NOTHING;

-- Índice para busca rápida por key
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
