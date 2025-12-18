-- ============================================
-- HOSTEL MANAGEMENT - ROOM TYPES MIGRATION
-- Adiciona novos tipos de quarto para hostel
-- ============================================

-- Adicionar novos valores ao enum room_type
-- PostgreSQL não permite ALTER TYPE ADD VALUE dentro de transação,
-- então executamos fora
ALTER TYPE room_type ADD VALUE IF NOT EXISTS 'Double';
ALTER TYPE room_type ADD VALUE IF NOT EXISTS 'Family';
ALTER TYPE room_type ADD VALUE IF NOT EXISTS 'Suite';

-- Adicionar coluna de descrição do quarto
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS description text;

-- Adicionar coluna para gênero do dormitório (Mixed, Female, Male)
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS gender_restriction text DEFAULT 'Mixed';

-- Adicionar coluna para número do quarto
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS room_number text;

-- Adicionar tipo de cama para quartos privativos
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS bed_type text DEFAULT 'Single';

-- Comentários explicativos dos tipos:
-- Dorm: Quarto compartilhado, reserva por cama individual
-- Private: Quarto privativo individual (1 pessoa)
-- Double: Quarto matrimonial (cama de casal)
-- Family: Quarto familiar (múltiplas camas, reserva do quarto inteiro)
-- Suite: Quarto premium com amenidades extras

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
