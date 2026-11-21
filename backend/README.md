# Backend de indicadores de evasão

API local em TypeScript/Fastify para consultar a camada Gold da [Pipeline-TCC](https://github.com/TCC-EvasaoMT/Pipeline-TCC). A primeira entrega oferece resumo anual, filtros e documentação interativa. A pipeline continua responsável pela extração, transformação e carga; a API apenas lê a Gold e calcula taxas sobre os totais selecionados.

## Preparar e iniciar

Requisitos: Node.js 22.13 ou superior, pnpm 11.25.0 e PostgreSQL 17 com a Gold carregada pela pipeline. O banco não é criado ou migrado pela API. Se o pnpm ainda não estiver instalado, depois de instalar o Node.js execute `npm install --global pnpm@11.25.0`.

O backend agora faz parte do workspace da raiz. Para instalar dependências, execute na raiz do repositório:

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

O servidor escuta exclusivamente em `127.0.0.1`. `pnpm start` serve também `frontend/dist` em `/`. Swagger só é registrado com `NODE_ENV=development`, inclusive na versão compilada. `NODE_ENV=production` desativa `/docs`. Esta entrega não inclui autenticação nem implantação pública.

| Variável | Uso |
| --- | --- |
| `NODE_ENV` | `development` por padrão; também aceita `test` e `production`. |
| `PORT` | Porta HTTP, padrão `3000`. |
| `POSTGRES_HOST` | Host do banco, padrão `127.0.0.1`. |
| `POSTGRES_PORT` | Porta do banco, padrão `5432`. |
| `POSTGRES_DB` | Obrigatória: nome do banco da pipeline. |
| `POSTGRES_USER` | Obrigatória: login exclusivo de leitura. |
| `POSTGRES_PASSWORD` | Obrigatória: senha desse login. |

Credenciais ausentes ou portas inválidas impedem a inicialização. Uma conexão indisponível mantém o HTTP ativo, mas as consultas respondem `503`. O pool tem até cinco conexões, espera de conexão de dois segundos e limite SQL de 2,5 segundos. Esses limites não substituem a medição de desempenho com a carga real.

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

Sem cliente local, abra o `psql` dentro do container e execute o conteúdo de `sql/permissoes.sql` depois de definir `\set api_role tcc_api`. O script concede `USAGE` no schema e `SELECT` apenas nas sete tabelas utilizadas pela API. Não concede acesso à Bronze, Silver nem escrita na Gold. Ele pressupõe uma role nova: não remove permissões antigas de usuários já existentes.

**Reaplique `sql/permissoes.sql` após cada transformação.** A pipeline executa `DROP SCHEMA gold CASCADE` e recria as tabelas, removendo os grants anteriores. Durante carga, bloqueio prolongado ou ausência de permissões, as rotas podem responder `503`; depois da reaplicação, o mesmo processo da API volta a consultar. Não há migrações ou inicialização automática da Gold no backend.

## Rotas e filtros

| Método e rota | Resultado |
| --- | --- |
| `GET /health` | Testa a leitura da fato e das dimensões. `200` com `{"status":"ok"}` ou `503`. Uma Gold vazia, mas acessível, é saudável. |
| `GET /api/v1/filtros` | Catálogo de todos os anos e opções presentes na fato de cursos. Não recebe parâmetros. |
| `GET /api/v1/indicadores/resumo` | Totais, base de risco, taxas e qualidade; exige `ano`. |
| `GET /docs/` | Swagger UI em desenvolvimento. A especificação fica em `/docs/json`. |

Exemplo no PowerShell:

```powershell
Invoke-RestMethod 'http://127.0.0.1:3000/api/v1/filtros'
Invoke-RestMethod 'http://127.0.0.1:3000/api/v1/indicadores/resumo?ano=2023&codigo_area_geral=01'
```

| Parâmetro | Tipo e significado |
| --- | --- |
| `ano` | Inteiro obrigatório, ano do censo. |
| `codigo_curso` | Texto, código original do curso. |
| `codigo_area_geral` | Texto, área geral CINE; preserva zeros iniciais, como `01`. |
| `codigo_municipio_oferta` | Texto, código IBGE do local de oferta presencial. |
| `modalidade` | Texto exatamente como retornado em `modalidades`. |
| `categoria_administrativa` | Texto de `categorias_administrativas`. |
| `organizacao_academica` | Texto de `organizacoes_academicas`. |
| `codigo_municipio_sede` | Texto, código IBGE da sede institucional, inclusive para EaD. |

Um valor por parâmetro, todos combinados por **E**. Parâmetros desconhecidos, repetidos ou inválidos retornam `400`. Valores válidos, mas inexistentes, retornam resumo sem dados com `200`. O ano não tem intervalo fixo de 2019–2023: novos anos carregados aparecem sem mudar o contrato.

O catálogo é independente do recorte atual. Códigos vêm como `{ "codigo": "01", "nome": "Educação" }`; o nome pode ser `null` quando falta referência. Categorias e modalidades são listas de textos. Os anos vêm da fato, evitando anos exclusivos de ingresso das coortes. Códigos nulos não são oferecidos como filtros; essas linhas continuam nos totais quando o respectivo filtro não é aplicado. Município de oferta ausente em EaD nunca é substituído pela sede.

Os IDs `id_*` da Gold não fazem parte do contrato: são reconstruídos pela pipeline. Instituições não são identificadas nominalmente; a combinação de filtros institucionais pode representar mais de uma IES.

## Cálculos e qualidade

Somente `gold.fato_evasao_curso` alimenta este incremento. Nenhuma fato de perfil, coorte ou docentes é somada a ela.

| Campo | Cálculo |
| --- | --- |
| `totais` | Somas de vínculos, ingressantes, matrículas, concluintes, cursando, desvinculados, transferidos, trancados e falecidos. |
| `base_risco` | `SUM(vinculos_total) - SUM(alunos_falecidos)`. |
| `taxas.evasao_curso` | `(SUM(alunos_desvinculados) + SUM(alunos_transferidos)) / base_risco`. |
| `taxas.evasao_ies` | `SUM(alunos_desvinculados) / base_risco`. |

As taxas são proporções: `0.2` significa 20%. Nunca se faz média de taxas individuais. As funções de cálculo ficam separadas do SQL e não dependem do PostgreSQL.

- Valores negativos e decimais permanecem nos resultados; não são arredondados para inteiros nem limitados a zero. Taxas não são limitadas a `[0,1]`.
- Base ausente ou não positiva retorna taxas `null`, nunca infinito ou uma falsa taxa zero.
- Sem linhas com vínculos, os totais são `null` e `qualidade.sem_dados=true`. Uma linha que informa zero vínculos é distinta de ausência de dados.
- Linhas apenas com docentes não contribuem para medidas de alunos e aparecem em `registros_sem_alunos`.
- Se uma medida falta em alguma linha com vínculos, seu total fica `null` e `dados_incompletos=true`. Isso evita dividir um numerador parcial por uma base completa. As outras medidas completas continuam disponíveis.
- `flag_valor_negativo` indica se alguma linha do recorte tem essa marca na Gold. Ela pode refletir medidas de docentes também, conforme a pipeline.
- `flag_grupo_pequeno` é recalculada pela **base agregada**, inferior a 30. Base desconhecida produz marca `null`.

Medidas são números JSON; o frontend deve formatar sua exibição. O SEDAP+ adiciona ruído e pode omitir grupos. A API descreve o conjunto disponível e não reconstrói valores omitidos nem identifica IES por fontes alternativas.

## Testar

```powershell
pnpm typecheck
pnpm test
pnpm build
```

Para integração, suba o banco descartável separado da pipeline:

```powershell
docker compose -f test/compose.yml up -d --wait
$env:TEST_DATABASE_URL = 'postgresql://postgres:tcc_test@127.0.0.1:55432/postgres'
pnpm test:integration
docker compose -f test/compose.yml down
```

A senha acima é somente do banco sintético local. A porta é `55432` e os dados ficam em memória. A suíte cria banco e login com nomes aleatórios e remove apenas esses objetos ao terminar. O usuário de `TEST_DATABASE_URL` precisa de permissão para criar banco e role; não é o usuário de leitura da aplicação. Sem essa variável a suíte de integração informa que foi pulada.

`test/fixtures/gold-schema.sql` é uma cópia apenas do DDL necessário aos testes, extraída do commit `ff66b7d44306a257fedde422a771848cc9a7899f` da pipeline. Não é uma migração de produção. `dados.sql` contém somente dados sintéticos.

Os testes cobrem taxas sobre somas, todos os filtros, códigos com zeros iniciais, EaD, ruído, dados ausentes, permissões e reconstrução da Gold. A medição de resposta com a fixture não comprova a meta de três segundos no volume real; essa validação depende de carregar os dados reais no ambiente alvo.

## Conciliação com o TCC I

Registrar na próxima revisão do Word:

| Previsão do Word | Implementação adotada |
| --- | --- |
| Microdados públicos em CSV | Consultas agregadas do SEDAP+, respostas JSON na Bronze; IBGE e CINE como referências. |
| Uma fato `fato_desempenho_curso` | A pipeline implementa quatro fatos; esta API usa `fato_evasao_curso`. |
| Vagas e inscritos | Não estão disponíveis na Gold atual e ficam fora dos indicadores. |
| Identificação de IES por nome/sigla | Filtros por características institucionais, sem identificação nominal. |
| Evasão operacional = desvinculados / matrículas | Evasão do curso e da IES sobre vínculos menos falecidos, conforme a modelagem Gold. |
| Infraestrutura AWS | Esta entrega executa localmente; nuvem fica para etapa posterior. |

A stack TypeScript/Fastify/pg e a finalidade de apoiar a análise da evasão são mantidas. Evolução temporal, perfis, coortes, administração da pipeline, autenticação e implantação não fazem parte deste incremento. A API não acessa a Bronze para deduzir status de execução ou datas de atualização.

Referências técnicas: [validação do Fastify](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/), [consultas parametrizadas do pg](https://node-postgres.com/features/queries) e [schema Gold da pipeline](https://github.com/TCC-EvasaoMT/Pipeline-TCC/blob/ff66b7d44306a257fedde422a771848cc9a7899f/sql/gold.sql).
