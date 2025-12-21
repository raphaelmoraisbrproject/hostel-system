-- =====================================================
-- HOSTEL SYSTEM - MÓDULO DE CONVITES DE USUÁRIOS
-- Migração para adicionar sistema de convites por token
-- =====================================================

-- =====================================================
-- 1. TABELA USER_INVITES (Convites de Usuários)
-- =====================================================
CREATE TABLE IF NOT EXISTS user_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'employee', 'volunteer')) DEFAULT 'employee',
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  invited_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  used_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(email),
  UNIQUE(token)
);

-- =====================================================
-- 2. ÍNDICES PARA PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_user_invites_token ON user_invites(token);
CREATE INDEX IF NOT EXISTS idx_user_invites_email ON user_invites(email);
CREATE INDEX IF NOT EXISTS idx_user_invites_expires_at ON user_invites(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_invites_used_at ON user_invites(used_at);

-- =====================================================
-- 3. HABILITAR RLS (Row Level Security)
-- =====================================================
ALTER TABLE user_invites ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 4. POLÍTICAS RLS
-- =====================================================

-- Política: Admin pode gerenciar todos os convites
DROP POLICY IF EXISTS "Admin can manage all invites" ON user_invites;
CREATE POLICY "Admin can manage all invites" ON user_invites
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
    )
  );

-- Política: Qualquer um pode verificar convite por token (para registro)
-- Esta política permite que usuários não autenticados validem o token durante o registro
DROP POLICY IF EXISTS "Anyone can verify invite by token" ON user_invites;
CREATE POLICY "Anyone can verify invite by token" ON user_invites
  FOR SELECT USING (true);

-- Política: Apenas admin pode inserir novos convites
DROP POLICY IF EXISTS "Admin can create invites" ON user_invites;
CREATE POLICY "Admin can create invites" ON user_invites
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
    )
  );

-- Política: Apenas admin pode atualizar convites (marcar como usado)
DROP POLICY IF EXISTS "Admin can update invites" ON user_invites;
CREATE POLICY "Admin can update invites" ON user_invites
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
    )
  );

-- =====================================================
-- 5. FUNÇÃO PARA VALIDAR CONVITE
-- =====================================================
CREATE OR REPLACE FUNCTION public.validate_invite_token(invite_token UUID)
RETURNS TABLE (
  valid BOOLEAN,
  email TEXT,
  role TEXT,
  invite_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (ui.expires_at > NOW() AND ui.used_at IS NULL) AS valid,
    ui.email,
    ui.role,
    ui.id AS invite_id
  FROM user_invites ui
  WHERE ui.token = invite_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. FUNÇÃO PARA MARCAR CONVITE COMO USADO
-- =====================================================
CREATE OR REPLACE FUNCTION public.mark_invite_as_used(invite_token UUID)
RETURNS BOOLEAN AS $$
DECLARE
  invite_record RECORD;
BEGIN
  -- Buscar o convite
  SELECT * INTO invite_record
  FROM user_invites
  WHERE token = invite_token
  AND expires_at > NOW()
  AND used_at IS NULL;

  -- Se não encontrou ou já foi usado, retornar false
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Marcar como usado
  UPDATE user_invites
  SET used_at = NOW()
  WHERE id = invite_record.id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 7. FUNÇÃO PARA LIMPAR CONVITES EXPIRADOS
-- =====================================================
CREATE OR REPLACE FUNCTION public.cleanup_expired_invites()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Deletar convites expirados há mais de 30 dias
  DELETE FROM user_invites
  WHERE expires_at < (NOW() - INTERVAL '30 days')
  AND used_at IS NULL;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FIM DA MIGRAÇÃO
-- =====================================================
