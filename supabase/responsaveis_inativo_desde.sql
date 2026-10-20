-- Desativação de responsáveis por competência.
-- inativo_desde = 'YYYY-MM': a partir dessa competência (inclusive) o responsável deixa de ser exibido.
-- NULL = ativo. Os dados dos meses anteriores permanecem intactos.
-- Execute uma vez no SQL Editor do Supabase.
ALTER TABLE responsaveis ADD COLUMN IF NOT EXISTS inativo_desde text;
