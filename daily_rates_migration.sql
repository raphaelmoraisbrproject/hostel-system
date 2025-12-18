-- Migration: Create daily_rates table (Idempotent for v1.5)
-- Description: Stores specific prices per room per date

-- 1. Criar a tabela de preços diários
CREATE TABLE IF NOT EXISTS daily_rates (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    room_id uuid REFERENCES rooms(id) ON DELETE CASCADE NOT NULL,
    date date NOT NULL,
    price decimal(10,2) NOT NULL CHECK (price >= 0),
    
    CONSTRAINT unique_room_date UNIQUE (room_id, date)
);

-- 2. Criar índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_daily_rates_room_date ON daily_rates(room_id, date);

-- 3. Habilitar Segurança (RLS)
ALTER TABLE daily_rates ENABLE ROW LEVEL SECURITY;

-- 4. Criar política de acesso (Garante idempotência removendo a anterior se existir)
DROP POLICY IF EXISTS "Enable all access for daily_rates" ON daily_rates;
CREATE POLICY "Enable all access for daily_rates" ON daily_rates FOR ALL USING (true) WITH CHECK (true);
