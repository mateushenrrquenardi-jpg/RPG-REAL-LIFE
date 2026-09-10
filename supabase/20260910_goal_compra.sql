-- Migration: adiciona tipo de meta 'compra' (aquisição/compra de item) e unidade 'reais'
-- Execute no Supabase > SQL Editor

-- 1. Remover constraint antiga de goal_type (só permite livro, curso)
ALTER TABLE public.quests
  DROP CONSTRAINT IF EXISTS quests_goal_type_check;

-- 2. Recriar constraint permitindo também 'compra'
ALTER TABLE public.quests
  ADD CONSTRAINT quests_goal_type_check
  CHECK (goal_type IS NULL OR goal_type IN ('livro', 'curso', 'compra'));

-- 3. Remover constraint antiga de goal_unit
ALTER TABLE public.quests
  DROP CONSTRAINT IF EXISTS quests_goal_unit_check;

-- 4. Recriar constraint permitindo também 'reais'
ALTER TABLE public.quests
  ADD CONSTRAINT quests_goal_unit_check
  CHECK (goal_unit IS NULL OR goal_unit IN ('paginas', 'aulas', 'porcentagem', 'horas', 'reais'));
