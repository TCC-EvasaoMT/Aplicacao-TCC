-- painel:consultar libera as rotas de consulta quando PAINEL_PUBLICO=false.
ALTER TABLE app.usuario_permissoes
    DROP CONSTRAINT usuario_permissoes_permissao_check;
ALTER TABLE app.usuario_permissoes
    ADD CONSTRAINT usuario_permissoes_permissao_check
    CHECK (permissao IN ('etl:consultar', 'etl:reprocessar', 'painel:consultar'));

-- Administradores existentes continuam vendo o painel quando ele for restrito.
INSERT INTO app.usuario_permissoes (usuario_id, permissao)
SELECT DISTINCT usuario_id, 'painel:consultar'
FROM app.usuario_permissoes
WHERE permissao = 'etl:reprocessar'
ON CONFLICT DO NOTHING;
