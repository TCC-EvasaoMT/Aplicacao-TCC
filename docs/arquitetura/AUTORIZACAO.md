# Acesso ao painel e à administração

O painel é público. A autenticação administrativa do backend usa credenciais locais, JWT no cabeçalho `Authorization: Bearer <token>` e sessões no schema `app` do mesmo PostgreSQL. Não depende de provedor externo. O painel tem login no cabeçalho; a administração do ETL ainda não foi implementada.

## Preparação

Siga [Banco da aplicação](BANCO_APLICACAO.md) para criar as roles e o schema, executar as migrações, conceder privilégios e criar o primeiro administrador. Não existe cadastro público nem senha padrão. Senhas são armazenadas como hashes Argon2id, com salt individual, 19 MiB de memória, duas iterações e paralelismo 1; não são criptografadas de forma reversível.

| Variável                                      | Uso                                                                                                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `AUTH_ENABLED`                                | `true` ativa as quatro rotas de autenticação. Padrão `false`, mantendo a demonstração pública existente. Não libera rotas protegidas. |
| `AUTH_JWT_SECRET`                             | Segredo aleatório exclusivo, com pelo menos 64 caracteres hexadecimais. Obrigatório quando habilitado.                                |
| `AUTH_ORIGIN`                                 | Origem exata do navegador, sem barra final ou caminho. Ex.: `http://127.0.0.1:3000` para Swagger direto.                              |
| `APP_POSTGRES_USER` / `APP_POSTGRES_PASSWORD` | Credenciais da role restrita de autenticação. Host, porta e banco são os mesmos `POSTGRES_*` usados pela Gold.                        |

Gere o segredo localmente; não compartilhe a saída nem a inclua em commits:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Com `AUTH_ENABLED=true`, configuração incompleta impede a inicialização. Banco ou schema indisponível impede login e acesso protegido, com erro controlado; não há fallback que conceda acesso. `/health` continua verificando somente a Gold e não comprova a disponibilidade da autenticação.

Para acesso por Vite e seu proxy, use `AUTH_ORIGIN=http://127.0.0.1:5173`, inclusive ao abrir `/docs/` através do Vite. `localhost` e `127.0.0.1` são origens diferentes. Em produção a origem deve usar HTTPS, e o servidor em loopback deve ficar atrás de um ingresso HTTPS configurado. Não há CORS para origens externas.

## Contrato HTTP

Prefixo: `/api/v1/autenticacao`.

| Método e rota   | Entrada                        | Resultado                                               |
| --------------- | ------------------------------ | ------------------------------------------------------- |
| `POST /login`   | JSON com `email` e `senha`     | `200`, JWT de acesso, identidade e cookie de renovação  |
| `POST /renovar` | Cookie de renovação; sem corpo | `200`, novo JWT e novo cookie; token anterior consumido |
| `POST /logout`  | Cookie da sessão; sem corpo    | `204`, revoga a sessão e remove o cookie; é idempotente |
| `GET /me`       | Cabeçalho Bearer               | `200`, identidade e permissões atuais                   |

Todos os POSTs acima exigem `Origin` igual a `AUTH_ORIGIN` e `X-CSRF-Protection: 1`. Origem ausente, divergente ou header ausente retorna `403`, antes de consultar credenciais. O header não é um segredo: impede envio por formulários de outros sites, em conjunto com a verificação de origem e a ausência de CORS. Clientes de terminal precisam enviar os dois headers explicitamente.

Exemplo do corpo de login (valores ilustrativos):

```json
{ "email": "admin@example.com", "senha": "sua senha cadastrada" }
```

A resposta contém `access_token`, `token_type: "Bearer"`, `expires_in: 600` e `usuario: { id, email, permissoes }`. Não contém senha, hash ou token de renovação no JSON. As respostas de autenticação e acesso protegido usam `Cache-Control: no-store`.

Credenciais incorretas, usuário inexistente e conta desativada recebem o mesmo `401`. O login permite cinco tentativas por minuto por IP (IPv6 /64) e por e-mail normalizado, incluindo tentativas bem-sucedidas. O excesso retorna `429` com `Retry-After`. Os contadores são locais ao processo e reiniciam com ele; o limite geral da API também se aplica. Antes de distribuir em réplicas, use armazenamento compartilhado para os limites.

## Sessão e tokens

O JWT dura dez minutos, usa HS256 e contém identificador do usuário (`sub`), identificador da sessão (`sid`), emissor, audiência e expiração. O backend restringe o algoritmo e valida assinatura, emissor, audiência e expiração. Não aceita token pela query string ou cookie como substituto do Bearer.

Em toda requisição protegida, o backend também consulta `app`: sessão precisa estar válida, usuário ativo e permissão presente. Permissões declaradas pelo React, query string ou cabeçalhos adicionais não concedem acesso. A consulta ao banco permite invalidar imediatamente os JWTs após logout ou revogação.

O refresh é um valor aleatório de 256 bits, entregue somente em cookie `HttpOnly`, `SameSite=Strict`, com caminho `/api/v1/autenticacao`. Em produção, usa `Secure` e nome `__Secure-tcc_refresh`; localmente, `tcc_refresh`. O banco armazena somente seu hash SHA-256. O cookie não é aceito como token de acesso.

A sessão expira sete dias após o login, sem prorrogação na renovação. Cada renovação consome o refresh anterior em uma transação com lock da sessão. Reutilizar um refresh consumido revoga toda a sessão, inclusive o token emitido na primeira renovação. Por isso o frontend serializa as renovações: na mesma aba, chamadas simultâneas compartilham uma única renovação; entre abas, a Web Locks API as enfileira, e cada aba envia o cookie já rotacionado pela anterior. Depois de uma revogação, é necessário novo login.

O logout revoga a sessão identificada pelo cookie e todos os seus JWTs; não encerra outras sessões do usuário. Apagar apenas o token do frontend não efetua logout. O frontend mantém o JWT só em memória e usa o cookie para recuperar a sessão ao recarregar a página. Para não chamar `/renovar` em toda visita anônima, guarda em `localStorage` apenas uma marca sem conteúdo sensível indicando que há sessão a restaurar. Login e logout são avisados às outras abas por `BroadcastChannel`.

## Autorização por rota

| Recurso                                          | Visitante | Conta autenticada           |
| ------------------------------------------------ | --------- | --------------------------- |
| Painel, catálogo, resumo, evolução e comparações | Permitido | Permitido                   |
| `/health`                                        | Permitido | Permitido                   |
| `/autenticacao/me`                               | `401`     | Permitido com sessão válida |
| Histórico do ETL (futuro)                        | `401`     | Exigirá `etl:consultar`     |
| Reprocessamento do ETL (futuro)                  | `401`     | Exigirá `etl:reprocessar`   |

`registrarAcesso`, exportado pelo módulo `autenticacao`, instala o controle antes dos módulos. Toda rota sob `/api/` deve declarar `config.acesso`; a ausência ou um valor desconhecido impede seu registro. Valores permitidos: `publico`, `autenticado`, `etl:consultar` e `etl:reprocessar`. As consultas existentes declaram `publico`. Exemplo para uma futura rota:

```ts
app.get(
	'/api/v1/etl/execucoes',
	{
		config: { acesso: 'etl:consultar' },
		schema: { security: [{ bearerAuth: [] }] }
	},
	handler
)
```

Sessão ausente, inválida, expirada ou revogada retorna `401`. Sessão válida sem a permissão exigida retorna `403`. `request.identidade` contém a identidade obtida do banco. A configuração de segurança no Swagger apenas documenta o Bearer; a proteção efetiva vem de `config.acesso` e do hook.

O comando de criação de administrador concede explicitamente as duas permissões. Não há rota HTTP para promover usuários. Para bloquear uma conta, use a conexão de manutenção, conferindo o e-mail antes de executar:

```sql
BEGIN;
UPDATE app.usuarios SET ativo = false WHERE email = 'admin@example.com';
UPDATE app.sessoes SET revogada_em = now()
WHERE usuario_id = (SELECT id FROM app.usuarios WHERE email = 'admin@example.com');
COMMIT;
```

Remover uma permissão de `app.usuario_permissoes` passa a valer na próxima requisição protegida. A credencial HTTP não tem permissão SQL para essas alterações.

## Testar no Swagger

Na base sintética, execute `pnpm dev:demo:auth` e defina a senha de `admin@demo.local` quando solicitado. O comando prepara o banco e a configuração; abra `http://127.0.0.1:5173/docs/` e siga a partir do passo 2 abaixo. A conta é preservada ao repetir o comando enquanto o contêiner estiver rodando. Veja [o roteiro completo da demonstração](../../README.md#testar-a-autenticação-na-demonstração).

1. Prepare o schema e o administrador; habilite `AUTH_ENABLED=true` e reinicie a API.
2. Abra `/docs/` pela origem configurada. Execute `/login`, informando e-mail, senha e `X-CSRF-Protection: 1`. O navegador controla o header `Origin`.
3. Copie `access_token` para **Authorize**, apenas o token; Swagger acrescenta `Bearer`. Execute `/me`.
4. Execute `/renovar`. O navegador envia e substitui o cookie; copie o novo JWT em **Authorize**.
5. Execute `/logout` e repita `/me`: deve retornar `401`, mesmo que o JWT ainda esteja dentro dos dez minutos.

O Swagger continua disponível somente em desenvolvimento. Não guarde tokens em exemplos versionados.

## Login no painel

O botão **Entrar**, no cabeçalho, abre uma gaveta com e-mail e senha, no mesmo padrão de foco e `inert` da gaveta de filtros. Com sessão ativa, o cabeçalho mostra o e-mail e o botão **Sair**. O módulo `frontend/src/modules/autenticacao` reúne o cliente HTTP (`api.ts`), o controle da sessão (`sessao.ts`) e o hook `useSessao`. Futuras telas administrativas obtêm o Bearer por `tokenAcesso()`, que renova o JWT a menos de um minuto da expiração. Exibir ou ocultar controles não concede acesso: o servidor confere sessão e permissões em cada chamada.

## Validação e próximos incrementos

Os testes usam PostgreSQL 17 sintético, roles restritas e bancos temporários. Cobrem migração repetida, preservação de contas após reconstrução da Gold, privilégios SQL, credenciais, Bearer, claims inválidas, expiração, logout, mudança de permissões, desativação, CSRF, rotação/reuso concorrente, limites e ausência de segredos nos logs. As consultas públicas são testadas com autenticação habilitada.

Permanecem para próximas entregas: recuperação de senha, MFA, gestão de usuários, integração e auditoria do ETL, limpeza agendada de sessões e configuração HTTPS/proxy em produção. Logs HTTP existentes registram rota, status e duração; não são uma trilha de auditoria de ações administrativas. A aplicação continua local e nenhum acesso a dados reais foi validado nesta entrega.
