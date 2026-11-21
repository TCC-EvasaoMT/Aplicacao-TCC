-- Executar como proprietário da Gold ou administrador, depois de CADA transformar.
-- O login indicado por api_role deve existir e ser exclusivo da API.
-- psql -v ON_ERROR_STOP=1 -v api_role=tcc_api -f sql/permissoes.sql
BEGIN;
GRANT USAGE ON SCHEMA gold TO :"api_role";
GRANT SELECT ON gold.fato_evasao_curso, gold.dim_tempo, gold.dim_curso,
  gold.dim_area_conhecimento, gold.dim_localidade, gold.dim_oferta,
  gold.dim_instituicao TO :"api_role";
COMMIT;
