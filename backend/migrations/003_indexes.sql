-- 003_indexes.sql
-- Achado na revisão final: a checagem "este ingrediente está em uso?"
-- (DELETE /api/manufacturing/ingredients/:id) filtra só por ingredient_id,
-- mas o único índice que cobre essa coluna é o composto
-- (product_id, ingredient_id) — que não ajuda uma busca só por ingredient_id
-- (regra do prefixo esquerdo). Sem isso, a checagem faz um seq scan na tabela.

CREATE INDEX IF NOT EXISTS product_ingredients_ingredient_idx ON product_ingredients(ingredient_id);
