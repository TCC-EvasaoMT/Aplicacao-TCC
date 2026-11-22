# Banco da aplicação

A aplicação usa o mesmo PostgreSQL 17 e o mesmo banco das camadas da pipeline, mas mantém usuários, permissões e sessões no schema `app`. Somente o backend controla suas migrações, em `backend/sql/migrations`. A pipeline continua responsável por Bronze, Silver e Gold.

## Preparação única

Não é necessário alterar o Docker Compose do PostgreSQL se o banco atual estiver acessível e houver uma conta autorizada a criar roles e schemas. Combine com o responsável pela pipeline a criação de duas roles exclusivas. Em uma sessão `psql` administrativa, conectada ao banco correto:

```sql
CREATE ROLE tcc_app_owner LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE ROLE tcc_auth LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE SCHEMA app AUTHORIZATION tcc_app_owner;
REVOKE ALL ON SCHEMA app FROM PUBLIC;
```

Defina senhas diferentes com `\password tcc_app_owner` e `\password tcc_auth` no `psql`, sem colocar senhas no histórico SQL. Se o banco tiver revogado `CONNECT` de `PUBLIC`, conceda `CONNECT` às duas roles no banco escolhido. As roles não devem herdar privilégios de outras contas. Em bancos que ainda concedem `CREATE` no schema `public` a `PUBLIC`, revise essa permissão com o administrador.

O dono `tcc_app_owner` cria tabelas e provisiona administradores. A API usa `tcc_auth`: pode ler usuários/permissões e criar/atualizar sessões e tokens, mas não criar usuários, conceder permissões ou alterar tabelas. A conexão de consulta à Gold continua usando a role de leitura já existente. Não use a conta administrativa do contêiner na API.

## Migrações e permissões

Configure `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `APP_MIGRATION_USER` e `APP_MIGRATION_PASSWORD` no ambiente do comando, ou no `backend/.env` local ignorado pelo Git. Não disponibilize as credenciais de migração ao processo HTTP em produção.

```sh
pnpm --filter tcc-evasao-backend db:migrate
```

O comando cria somente objetos de `app`, registra versão e checksum em `app.migracoes` e aplica alterações em transação, com lock contra execução simultânea. Pode ser repetido; migrações aplicadas não são executadas novamente. Uma migração já aplicada não deve ser editada: crie outro arquivo numerado. O servidor HTTP não executa migrações automaticamente.

Depois, como `tcc_app_owner` ou administrador, execute na raiz do monorepo (o `psql` solicitará a senha):

```sh
psql -h 127.0.0.1 -p 5432 -U tcc_app_owner -d NOME_DO_BANCO -W -v auth_role=tcc_auth -f backend/sql/permissoes-app.sql
```

Repita a concessão quando novas migrações adicionarem tabelas usadas pela API. Não há concessão automática de acesso a todas as tabelas futuras.

## Primeiro administrador

Com as credenciais de migração disponíveis apenas no terminal de manutenção:

```sh
pnpm --filter tcc-evasao-backend auth:criar-admin admin@example.com
```

O comando pede senha e confirmação com entrada oculta, exige entre 15 e 128 caracteres e armazena um hash Argon2id com salt individual. Concede `etl:consultar` e `etl:reprocessar` em uma transação. E-mail é normalizado para minúsculas; uma conta existente nunca é substituída. Não existe autocadastro público nem senha padrão.

## Relação com a pipeline e manutenção

Reconstruir `gold` não modifica `app`. Apagar o banco inteiro ou seu volume apaga ambos: alinhe esse limite com o colega e inclua `app` no backup. Roles superusuárias continuam podendo acessar todos os schemas; schemas não isolam dados de um superusuário.

As migrações e o provisionamento são executados fora da pipeline. Não coloque a única criação de tabelas em `docker-entrypoint-initdb.d`: esses scripts só rodam quando o volume é inicializado. Um volume existente precisa receber as migrações pelo comando acima.

Sessões têm validade absoluta de sete dias. Em manutenção, o dono pode executar `DELETE FROM app.sessoes WHERE expira_em <= now()`; os hashes de renovação associados são removidos por cascata. Não remova tokens consumidos de sessões ainda válidas: eles detectam reutilização. A automação dessa limpeza e a política de backup da implantação ainda precisam ser definidas.
