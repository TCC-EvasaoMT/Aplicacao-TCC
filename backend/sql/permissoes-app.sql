-- Executar como dono do schema após as migrações:
-- psql ... -v auth_role=tcc_auth -f backend/sql/permissoes-app.sql
REVOKE ALL ON SCHEMA app FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA app FROM PUBLIC;
GRANT USAGE ON SCHEMA app TO :"auth_role";
GRANT SELECT ON app.usuarios, app.usuario_permissoes TO :"auth_role";
GRANT SELECT, INSERT, UPDATE ON app.sessoes, app.tokens_renovacao TO :"auth_role";
