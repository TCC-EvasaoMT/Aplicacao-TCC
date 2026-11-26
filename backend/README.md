# Backend de indicadores de evasão

API em TypeScript/Fastify para consultar a camada Gold da [Pipeline-TCC](https://github.com/TCC-EvasaoMT/Pipeline-TCC). Oferece catálogo de filtros, resumo anual, evolução temporal, comparações e Swagger em desenvolvimento. A pipeline extrai, transforma e carrega os dados; a API lê a Gold e calcula taxas sobre os totais selecionados.

## Preparar e iniciar

O código está organizado em `src/modules/catalogos`, `src/modules/indicadores`, `src/modules/analises` e `src/modules/autenticacao`, com plugins compartilhados em `src/plugins`, configuração em `src/config` e comandos de manutenção do schema `app` em `src/database`. Veja a [arquitetura](../docs/arquitetura/ARQUITETURA.md) e os [contratos dos módulos](../docs/arquitetura/MODULOS_BACKEND.md). A extração do catálogo preserva `GET /api/v1/filtros` e sua resposta.

Requisitos: Node.js 22.13 ou superior, pnpm 11.25.0 e PostgreSQL 17 com a Gold carregada pela pipeline. O servidor não cria o banco nem executa migrações; o comando de manutenção `db:migrate` migra somente o schema `app`, usado pela autenticação. Se o pnpm ainda não estiver instalado, depois de instalar o Node.js execute `npm install --global pnpm@11.25.0`.

O backend faz parte do workspace pnpm. Para instalar as dependências, execute na raiz do repositório:

```powershell
pnpm install --frozen-lockfile
```

Se `backend/.env` ainda não existir, copie `backend/.env.example` para ele. Preserve configurações locais existentes. Para iniciar frontend e backend juntos, use `pnpm dev` na raiz; o frontend ficará em `http://127.0.0.1:5173/`.

Edite `.env` com o banco da pipeline e as credenciais do usuário **de leitura** preparado abaixo. Não utilize o usuário administrador ou o usuário de carga na API.

Para iniciar somente a API, execute `pnpm dev:backend` na raiz, ou `pnpm dev` dentro de `backend`.

Abra [Swagger](http://127.0.0.1:3000/docs/) e execute primeiro `GET /api/v1/filtros`, depois `GET /api/v1/indicadores/resumo` usando um ano retornado pelo catálogo. Os exemplos exibidos no Swagger são sintéticos.

Para executar a versão compilada com a interface React, use estes comandos na raiz:

```powershell
pnpm build
pnpm start
```

O servidor escuta em `127.0.0.1` por padrão. A imagem Docker define `HTTP_HOST=0.0.0.0` para receber tráfego da porta publicada pelo Docker. `pnpm start` serve também `frontend/dist` em `/`. Swagger só é registrado com `NODE_ENV=development`. A autenticação administrativa é opcional (`AUTH_ENABLED`). Consulte o [guia da EC2](../docs/operacao/DOCKER_EC2.md).

| Variável                                        | Uso                                                                                                                     |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                                      | `development` por padrão; também aceita `test` e `production`.                                                          |
| `PORT`                                          | Porta HTTP, padrão `3000`.                                                                                              |
| `HTTP_HOST`                                     | IP de escuta (não aceita nomes), padrão `127.0.0.1`; a imagem Docker usa `0.0.0.0`.                                     |
| `HTTP_RATE_LIMIT_MAX`                           | Chamadas por minuto por IP e processo em `/api`, padrão `120`; aceita de 1 a 10000.                                     |
| `HTTP_TRUST_PROXY`                              | IPs ou faixas CIDR dos proxies confiáveis, separados por vírgula; vazio (padrão) desativa. Recusa `0.0.0.0/0` e `::/0`. |
| `POSTGRES_HOST`                                 | Host do banco, padrão `127.0.0.1`.                                                                                      |
| `POSTGRES_PORT`                                 | Porta do banco, padrão `5432`.                                                                                          |
| `POSTGRES_DB`                                   | Obrigatória: nome do banco da pipeline.                                                                                 |
| `POSTGRES_USER`                                 | Obrigatória: login exclusivo de leitura.                                                                                |
| `POSTGRES_PASSWORD`                             | Obrigatória: senha desse login.                                                                                         |
| `AUTH_ENABLED`                                  | `true` habilita a autenticação administrativa; padrão `false`.                                                          |
| `AUTH_JWT_SECRET`                               | Com autenticação: segredo aleatório de pelo menos 64 caracteres hexadecimais.                                           |
| `AUTH_ORIGIN`                                   | Com autenticação: origem exata do navegador, como `http://127.0.0.1:5173` no `pnpm dev`.                                |
| `APP_POSTGRES_USER` / `APP_POSTGRES_PASSWORD`   | Com autenticação: role restrita ao schema `app` usada pelo servidor.                                                    |
| `APP_MIGRATION_USER` / `APP_MIGRATION_PASSWORD` | Somente nos comandos de manutenção; nunca no processo HTTP.                                                             |

Credenciais ausentes ou portas inválidas impedem a inicialização. Uma conexão indisponível mantém o HTTP ativo, mas as consultas respondem `503`. O pool de leitura da Gold tem até cinco conexões, espera de conexão de dois segundos e limite SQL de 2,5 segundos; com autenticação, o pool de `app` tem até três conexões e os mesmos limites. Esses limites não substituem a medição de desempenho com a carga real.

Consulte a [proteção da API pública](../docs/operacao/SEGURANCA_API.md) para limites HTTP, respostas `429`, cabeçalhos e cuidados com proxy. O painel continua público. Para habilitar a autenticação administrativa, siga [autenticação e autorização](../docs/arquitetura/AUTORIZACAO.md) e [preparação do schema app](../docs/arquitetura/BANCO_APLICACAO.md). Depois de criar as roles e o schema e configurar as credenciais de manutenção, execute na raiz:

```sh
pnpm --filter tcc-evasao-backend db:migrate
# Aplique sql/permissoes-app.sql como descrito no guia do banco.
pnpm --filter tcc-evasao-backend auth:criar-admin admin@example.com
```

Em seguida configure `AUTH_ENABLED=true`, `AUTH_JWT_SECRET`, `AUTH_ORIGIN` e `APP_POSTGRES_USER`/`APP_POSTGRES_PASSWORD` conforme `.env.example` e reinicie o backend. Não use as credenciais de manutenção no servidor. Na base sintética, `pnpm dev:demo:auth` faz toda a preparação.

## Preparar o acesso ao PostgreSQL

Depois de executar `python -m pipeline transformar` no projeto da pipeline, conecte-se ao banco como administrador usando `psql`. Se o banco estiver em Docker, o cliente pode ser aberto dentro do container da pipeline com `docker compose --env-file .env -f infra/docker-compose.yml exec postgres psql -U SEU_USUARIO -d SEU_BANCO`.

Crie uma vez um login novo, sem associação a outras roles:

```sql
CREATE ROLE tcc_api LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
```

No prompt do `psql`, defina a senha sem escrevê-la no arquivo SQL ou no histórico de comandos do shell:

```text
\password tcc_api
```

Conceda `CONNECT` ao banco se ele não permitir conexões por padrão. Com o cliente `psql` local, aplique as permissões a partir da pasta `backend`:

```powershell
psql -h 127.0.0.1 -U SEU_USUARIO_ADMIN -d SEU_BANCO -v ON_ERROR_STOP=1 -v api_role=tcc_api -f sql/permissoes.sql
```

Sem cliente local, abra o `psql` dentro do container e execute o conteúdo de `sql/permissoes.sql` depois de definir `\set api_role tcc_api`. O script concede `USAGE` no schema e `SELECT` apenas nas dez tabelas utilizadas pela API: as três fatos de alunos (por curso, por coorte e por perfil), as seis dimensões do curso e a `dim_perfil`. Não concede acesso à Bronze, Silver nem escrita na Gold. Ele pressupõe uma role nova: não remove permissões antigas de usuários já existentes.

**Reaplique `sql/permissoes.sql` após cada transformação.** A pipeline executa `DROP SCHEMA gold CASCADE` e recria as tabelas, removendo os grants anteriores. Durante carga, bloqueio prolongado ou ausência de permissões, as rotas podem responder `503`; depois da reaplicação, o mesmo processo da API volta a consultar. Não há migrações ou inicialização automática da Gold no backend.

## Rotas e filtros

| Método e rota                            | Resultado                                                                                                                                      |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /health`                            | Testa a leitura da fato e das dimensões. `200` com `{"status":"ok"}` ou `503`. Uma Gold vazia, mas acessível, é saudável.                      |
| `GET /api/v1/filtros`                    | Catálogo de todos os anos e opções presentes na fato de cursos. Não recebe parâmetros.                                                         |
| `GET /api/v1/indicadores/resumo`         | Totais, base de risco, taxas e qualidade; exige `ano`.                                                                                         |
| `GET /api/v1/analises/evolucao-temporal` | Série anual com os mesmos indicadores e filtros; exige `ano_inicial` e `ano_final`, até 30 anos inclusivos.                                    |
| `GET /api/v1/analises/comparacoes`       | Totais, taxas e qualidade por grupo no mesmo ano; exige `ano` e `agrupar_por`. Até 20 grupos, com seleção opcional e aviso de truncamento.     |
| `GET /api/v1/analises/dispersao`         | Todos os cursos do ano com matrículas, taxas e qualidade, a linha de alta evasão de cada taxa e a zona crítica; exige `ano`.                   |
| `GET /api/v1/analises/ranking`           | Todas as áreas gerais ou modalidades do ano, ordenadas pela taxa escolhida, com empates, bases pequenas e ausências; exige `ano` e `dimensao`. |
| `GET /api/v1/analises/perfil`            | Taxas de evasão por categoria de um dos 12 fatores de perfil, na ordem do catálogo, com o conjunto do fator; exige `ano` e `fator`.            |
| `GET /api/v1/analises/coorte`            | Acompanha uma turma de ingresso: já evadiu, já concluiu, continua no curso e resíduo em cada censo seguinte; exige `ano_ingresso`.             |
| `POST /api/v1/autenticacao/login`        | Inicia a sessão; retorna JWT e cookie de renovação. Exige proteção CSRF.                                                                       |
| `POST /api/v1/autenticacao/renovar`      | Rotaciona o cookie e emite novo JWT. Exige proteção CSRF.                                                                                      |
| `POST /api/v1/autenticacao/logout`       | Revoga a sessão do cookie. Exige proteção CSRF.                                                                                                |
| `GET /api/v1/autenticacao/me`            | Identidade e permissões atuais; exige Bearer.                                                                                                  |
| `POST /api/v1/autenticacao/senha`        | Troca a própria senha e revoga as outras sessões da conta; exige Bearer, proteção CSRF e a senha atual.                                        |
| `GET /docs/`                             | Swagger UI em desenvolvimento. A especificação fica em `/docs/json`.                                                                           |

Exemplo no PowerShell:

```powershell
Invoke-RestMethod 'http://127.0.0.1:3000/api/v1/filtros'
Invoke-RestMethod 'http://127.0.0.1:3000/api/v1/indicadores/resumo?ano=2023&codigo_area_geral=01'
Invoke-RestMethod 'http://127.0.0.1:3000/api/v1/analises/comparacoes?ano=2023&agrupar_por=curso&grupos=001&grupos=002'
```

A comparação é pública e usa a conexão de leitura. Consulte [dimensões, seleção de grupos, regras de ausência e truncamento](../docs/api/COMPARACOES.md). A seleção `grupos` é o único parâmetro que aceita repetição nessa rota; os filtros de recorte aceitam um valor cada. O [frontend de comparações](../docs/frontend/COMPARACOES.md) já está integrado ao painel.

| Parâmetro                  | Tipo e significado                                            |
| -------------------------- | ------------------------------------------------------------- |
| `ano`                      | Inteiro obrigatório, ano do censo.                            |
| `codigo_curso`             | Texto, código original do curso.                              |
| `codigo_area_geral`        | Texto, área geral CINE; preserva zeros iniciais, como `01`.   |
| `codigo_municipio_oferta`  | Texto, código IBGE do local de oferta presencial.             |
| `modalidade`               | Texto exatamente como retornado em `modalidades`.             |
| `categoria_administrativa` | Texto de `categorias_administrativas`.                        |
| `organizacao_academica`    | Texto de `organizacoes_academicas`.                           |
| `codigo_municipio_sede`    | Texto, código IBGE da sede institucional, inclusive para EaD. |

Os filtros aceitam um valor por parâmetro e combinam por E. Parâmetros desconhecidos, repetidos ou inválidos retornam `400`. Valores válidos, mas inexistentes, retornam resumo sem dados com `200`. O ano não está restrito ao recorte de pesquisa de 2019 a 2023: novos anos carregados aparecem sem mudar o contrato. A API não aplica automaticamente uma restrição a MT, à graduação ou às IES públicas; a pipeline deve entregar a Gold com o recorte acordado.

O catálogo é independente do recorte atual. Códigos vêm como `{ "codigo": "01", "nome": "Educação" }`; o nome pode ser `null` quando falta referência. Categorias e modalidades são listas de textos. Os anos vêm da fato, evitando anos exclusivos de ingresso das coortes. Códigos nulos não são oferecidos como filtros; essas linhas continuam nos totais quando o respectivo filtro não é aplicado. Município de oferta ausente em EaD nunca é substituído pela sede.

Os IDs `id_*` da Gold não fazem parte do contrato: são reconstruídos pela pipeline. Instituições não são identificadas nominalmente; a combinação de filtros institucionais pode representar mais de uma IES.

## Cálculos e qualidade

Na evolução temporal, as regras abaixo são aplicadas separadamente por ano. Anos sem registros aparecem com medidas `null`, e o período solicitado não é reduzido silenciosamente. Veja o [contrato e os exemplos da série temporal](../docs/api/ANALISES_TEMPORAIS.md).

As consultas usam exclusivamente `gold.fato_evasao_curso` e suas dimensões. Fatos de perfil, coorte e contexto docente não são somadas a ela. O guia de [fontes e indicadores](../docs/metodologia/FONTES_E_INDICADORES.md) explica o grão, a origem e os limites dessas medidas.

| Campo                       | Cálculo                                                                                                              |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `totais`                    | Somas de vínculos, concluintes, cursando, desvinculados, transferidos, trancados e falecidos da `fato_evasao_curso`. |
| `totais.matriculas_total`   | `SUM(alunos_cursando) + SUM(concluintes_total)`: vínculo cursando ou formado, definição do INEP.                     |
| `totais.ingressantes_total` | Soma de `vinculos_total` da `fato_evasao_coorte` na linha com ano de ingresso igual ao ano do censo.                 |
| `base_risco`                | `SUM(vinculos_total) - SUM(alunos_falecidos)`.                                                                       |
| `taxas.evasao_curso`        | `(SUM(alunos_desvinculados) + SUM(alunos_transferidos)) / base_risco`.                                               |
| `taxas.evasao_ies`          | `SUM(alunos_desvinculados) / base_risco`.                                                                            |

As taxas são proporções: `0.2` significa 20%. Nunca se faz média de taxas individuais. As funções de cálculo ficam separadas do SQL e não dependem do PostgreSQL.

- Valores negativos e decimais permanecem nos resultados; não são arredondados para inteiros nem limitados a zero. Taxas não são limitadas a `[0,1]`.
- Base ausente ou não positiva retorna taxas `null`, nunca infinito ou uma falsa taxa zero.
- Sem linhas com vínculos, os totais são `null` e `qualidade.sem_dados=true`. Uma linha que informa zero vínculos é distinta de ausência de dados.
- Linhas apenas com docentes não contribuem para medidas de alunos e aparecem em `registros_sem_alunos`.
- Se uma medida falta em alguma linha com vínculos, seu total fica `null` e `dados_incompletos=true`. Isso evita dividir um numerador parcial por uma base completa. As outras medidas completas continuam disponíveis.
- `flag_valor_negativo` indica se alguma medida exibida é negativa em alguma linha do recorte. É calculada na consulta; a marca da Gold não é usada porque também reflete as colunas descartadas.
- As colunas `ingressantes_total` e `matriculas_total` da `fato_evasao_curso` não são lidas: na extração do SEDAP+, o ruído delas chega a dezenas de milhares por curso. As demais medidas vêm de contagens com ruído pequeno.
- A linha de ingresso da coorte falta em parte dos cursos, sem ingressantes no ano ou omitidos pelo SEDAP+. `qualidade.registros_sem_ingressantes` conta esses cursos e, havendo algum, `qualidade.ingressantes_minimo=true`: o total soma apenas os cursos com a linha e é um mínimo. Sem nenhuma linha no recorte, o total é `null`. Essa ausência não torna as outras medidas incompletas.
- `flag_grupo_pequeno` é recalculada pela **base agregada**, inferior a 30. Base desconhecida produz marca `null`.

Medidas são números JSON; o frontend deve formatar sua exibição. O SEDAP+ adiciona ruído e pode omitir grupos. A API descreve o conjunto disponível e não reconstrói valores omitidos nem identifica IES por fontes alternativas.

## Testar

```powershell
pnpm typecheck
pnpm test
pnpm build
```

Para integração, execute os comandos abaixo dentro de `backend/`. O banco é descartável e separado da pipeline:

```powershell
docker compose -f test/compose.yml up -d --wait
$env:TEST_DATABASE_URL = 'postgresql://postgres:tcc_test@127.0.0.1:55432/postgres'
pnpm test:integration
docker compose -f test/compose.yml down
```

A senha acima é somente do banco sintético local. A porta é `55432` e os dados ficam em memória. A suíte cria banco e login com nomes aleatórios e remove apenas esses objetos ao terminar. O usuário de `TEST_DATABASE_URL` precisa de permissão para criar banco e role; não é o usuário de leitura da aplicação. Sem essa variável a suíte de integração informa que foi pulada.

`test/fixtures/gold-schema.sql` é uma cópia apenas do DDL necessário aos testes, extraída do commit `ff66b7d44306a257fedde422a771848cc9a7899f` da pipeline. Não é uma migração de produção. `dados.sql` contém somente dados sintéticos.

Os testes cobrem taxas sobre somas, todos os filtros, códigos com zeros iniciais, EaD, ruído, dados ausentes, permissões e reconstrução da Gold, além de migrações de `app`, sessões, renovação, revogação, troca de senha, CSRF e a dispersão por curso, cujos itens são conferidos contra o resumo de cada curso. A medição de resposta com a fixture não comprova a meta de três segundos no volume real; essa validação depende de carregar os dados reais no ambiente alvo.

## Conciliação com o TCC I

Registrar na próxima revisão do Word:

| Previsão do Word                                | Implementação adotada                                                                  |
| ----------------------------------------------- | -------------------------------------------------------------------------------------- |
| Microdados públicos em CSV                      | Consultas agregadas do SEDAP+, respostas JSON na Bronze; IBGE e CINE como referências. |
| Uma fato `fato_desempenho_curso`                | A pipeline implementa quatro fatos; esta API usa `fato_evasao_curso`.                  |
| Vagas e inscritos                               | Não estão disponíveis na Gold atual e ficam fora dos indicadores.                      |
| Identificação de IES por nome/sigla             | Filtros por características institucionais, sem identificação nominal.                 |
| Evasão operacional = desvinculados / matrículas | Evasão do curso e da IES sobre vínculos menos falecidos, conforme a modelagem Gold.    |
| Infraestrutura AWS                              | Esta entrega executa localmente; nuvem fica para etapa posterior.                      |

A stack TypeScript/Fastify/pg e a finalidade de apoiar a análise da evasão são mantidas. Evolução temporal, comparações, dispersão por curso e o ranking simultâneo de áreas e modalidades têm API e visualização. A administração da pipeline e a implantação estão pendentes. Perfis e coortes dependem de definição de escopo. A autenticação administrativa (login, sessão, permissões e troca de senha) está implementada no backend e no painel; as rotas de administração do ETL ainda não. A API não acessa a Bronze para deduzir status de execução ou datas de atualização.

A [matriz de requisitos do TCC](../docs/tcc/RASTREABILIDADE.md) detalha as diferenças, incluindo o cartão de desvinculados ausente na interface, a comparação nominal de IES e as metas operacionais ainda não verificadas. Atualizar a documentação da aplicação não altera nem aprova uma revisão dos requisitos acadêmicos.

Referências técnicas: [validação do Fastify](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/), [consultas parametrizadas do pg](https://node-postgres.com/features/queries) e [schema Gold da pipeline](https://github.com/TCC-EvasaoMT/Pipeline-TCC/blob/ff66b7d44306a257fedde422a771848cc9a7899f/sql/gold.sql).
