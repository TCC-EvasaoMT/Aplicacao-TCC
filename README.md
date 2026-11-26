# Aplicação de análise da evasão em Mato Grosso

Monorepo com React, TypeScript e Fastify. O frontend consulta a API, e o backend lê os indicadores da Gold no PostgreSQL. A [pipeline Python](https://github.com/TCC-EvasaoMT/Pipeline-TCC) continua em seu próprio repositório, alimentando o banco de forma independente.

## Organização

Para executar a aplicação em container e preparar a EC2 para testes de carga, consulte o [guia da imagem Docker](docs/operacao/DOCKER_EC2.md).

```text
frontend/              React e Vite; resumo, perfil, filtros, evolução, comparações, ranking, dispersão e login
backend/               API Fastify, regras de cálculo e acesso à Gold
backend/src/modules/   Módulos de catálogos, indicadores, análises e autenticação
backend/src/database/  Migrações do schema app e criação de administrador
backend/src/plugins/   Recursos compartilhados e saúde da API
docs/                  Documentação da aplicação e da arquitetura
.github/               CI e modelo de pull request
pnpm-workspace.yaml    Pacotes do workspace
pnpm-lock.yaml         Único lockfile da aplicação
```

O backend é um monólito modular: catálogos, indicadores e análises são plugins encapsulados do Fastify, cada um com entrada pública em `index.ts`. A autenticação instala o controle de acesso na raiz e registra suas rotas em `/api/v1/autenticacao`. O catálogo continua acessível em `/api/v1/filtros`. Novos módulos serão adicionados quando houver funcionalidades que justifiquem a separação.

O [índice da documentação](docs/README.md) reúne arquitetura, contratos, interface e operação. A [comparação com o TCC](docs/tcc/RASTREABILIDADE.md) registra os requisitos atendidos e as lacunas; [fontes e indicadores](docs/metodologia/FONTES_E_INDICADORES.md) explica o recorte e as fórmulas. A pasta local `docs-codex/` permanece ignorada pelo Git.

O frontend não importa arquivos internos do backend e não acessa o banco. Ele usa HTTP/JSON em `/api/v1`. As fórmulas de evasão continuam no backend; a interface apenas formata os resultados.

A interface apresenta resumo anual com o [perfil de quem evade](docs/frontend/PERFIL.md), evolução temporal, comparação entre grupos, [ranking de áreas e modalidades](docs/frontend/RANKING.md) e [dispersão por curso](docs/frontend/DISPERSAO.md) em abas no cabeçalho, com filtros compartilhados numa gaveta. Resumo e comparação compartilham o ano; o gráfico temporal mantém seu próprio período. O tema usa Source Sans 3 servida localmente, duas taxas com igual destaque e totais em uma faixa compacta. A seção **Como interpretar os dados** reúne as explicações metodológicas.

A [API de evolução temporal](docs/api/ANALISES_TEMPORAIS.md) permite consultar séries anuais em `/api/v1/analises/evolucao-temporal`, com intervalo inclusivo de até 30 anos e os mesmos filtros de recorte. O [módulo de análises do frontend](docs/frontend/ANALISES.md) apresenta as duas taxas em um gráfico Recharts e uma tabela de valores e qualidade por ano. A interface usa componentes do PrimeReact 10 (licença MIT) em modo sem estilo e Tailwind CSS 4 para o layout e a identidade visual, conforme a [documentação de estilização](docs/frontend/ESTILIZACAO.md).

## Executar em desenvolvimento

Requisitos: Node.js 22.13 ou superior (validado com Node 24), pnpm 11.25.0 e PostgreSQL 17 com a Gold carregada. Para instalar o gerenciador, use `npm install --global pnpm@11.25.0`.

Execute na raiz do repositório:

```powershell
pnpm install --frozen-lockfile
```

Se `backend/.env` ainda não existir, crie-o a partir de `backend/.env.example` e configure o usuário de leitura do banco. A [documentação do backend](backend/README.md) explica as permissões e a carga da Gold. Uma configuração local já existente é preservada ao migrar para o monorepo.

O painel continua público. O backend também oferece [autenticação administrativa JWT/Bearer](docs/arquitetura/AUTORIZACAO.md), habilitada por configuração. O [guia do banco da aplicação](docs/arquitetura/BANCO_APLICACAO.md) explica a criação do schema `app`, migrações e primeiro administrador no PostgreSQL existente, sem alterar a pipeline. O cabeçalho do painel tem os botões **Entrar**, **Alterar senha** e **Sair**, descritos em [login e sessão no painel](docs/frontend/AUTENTICACAO.md).

Pare os servidores antigos antes de iniciar o conjunto, para liberar as portas 3000 e 5173:

```powershell
pnpm dev
```

- Frontend: [http://127.0.0.1:5173/](http://127.0.0.1:5173/).
- Swagger pelo frontend: [http://127.0.0.1:5173/docs/](http://127.0.0.1:5173/docs/).
- API diretamente: [http://127.0.0.1:3000/health](http://127.0.0.1:3000/health).

O comando inicia os dois pacotes. O Vite encaminha `/api`, `/health` e `/docs` para o Fastify, usando a porta `PORT` de `backend/.env` ou do terminal. Apenas a porta é lida pela configuração do Vite; credenciais do banco não são expostas ao navegador. A interface e a API escutam somente em `127.0.0.1`.

A tela inicial exibe vínculos, matrículas, ingressantes, concluintes e taxas de evasão. Permite combinar ano, curso, área CINE, modalidade, categoria administrativa, organização acadêmica e municípios de oferta e sede. Os filtros são aplicados automaticamente; limpar mantém o ano e atualizar preserva as seleções ainda disponíveis. O gráfico temporal usa os mesmos filtros opcionais e um intervalo próprio, independente do ano do resumo. Mostra estados de carregamento, erro, ausência de dados e qualidade. Ela utiliza a base conectada, sem injetar números fictícios no frontend.

A [API de comparações entre cursos e grupos](docs/api/COMPARACOES.md) está disponível no Swagger, em `GET /api/v1/analises/comparacoes`, sem login. Exemplo: `?ano=2023&agrupar_por=curso&grupos=001&grupos=002`. O [frontend de comparações](docs/frontend/COMPARACOES.md) permite escolher a dimensão e até 20 grupos, com barras horizontais, tabela de totais e qualidade e avisos de truncamento ou ausência. Para testar, use 2023 na aba **Comparação**. No topo da mesma aba, o ranking mostra todas as áreas gerais e modalidades ao mesmo tempo, pela [API de ranking](docs/api/RANKING.md) (`GET /api/v1/analises/ranking?ano=2023&dimensao=area_geral`).

O guia de [estado e exportação](docs/frontend/ESTADO_E_EXPORTACAO.md) descreve o link compartilhável, o CSV, o layout do celular e o carregamento dos gráficos. A [interatividade](docs/frontend/INTERATIVIDADE.md) explica a filtragem cruzada: clicar num grupo aplica o filtro ao resumo e à evolução; clicar num ano altera o resumo e a comparação. Os cartões mostram a variação contra o ano anterior.

## Executar a versão compilada

Na raiz:

```powershell
pnpm build
pnpm start
```

Abra [http://127.0.0.1:3000/](http://127.0.0.1:3000/), ou a porta configurada. Um único processo Fastify serve os arquivos de `frontend/dist` e a API. O comando `start` inclui `--serve-frontend`; sem o build da interface, o servidor informa como gerá-lo.

Para usar o modo de produção, defina `NODE_ENV=production` no ambiente do backend antes de iniciar. Isso desativa o Swagger. O frontend compilado também não exibe o link de documentação. Rotas de navegação da SPA recebem `index.html`; endpoints inexistentes em `/api`, `/health` e `/docs`, arquivos estáticos ausentes e requisições não HTML continuam retornando `404`.

Distribua `backend/dist`, `frontend/dist`, os manifests e o lockfile mantendo a estrutura de diretórios. A instalação de dependências e a configuração do PostgreSQL fazem parte do ambiente de execução. Este incremento não configura hospedagem, TLS ou acesso público.

## Comandos da raiz

| Comando                 | Resultado                                                       |
| ----------------------- | --------------------------------------------------------------- |
| `pnpm dev`              | Inicia frontend e backend em desenvolvimento.                   |
| `pnpm dev:frontend`     | Inicia apenas o Vite.                                           |
| `pnpm dev:backend`      | Inicia apenas a API.                                            |
| `pnpm typecheck`        | Verifica os tipos dos dois pacotes.                             |
| `pnpm test`             | Executa os testes automatizados existentes.                     |
| `pnpm build`            | Compila React e Fastify.                                        |
| `pnpm check`            | Verifica tipos, executa testes e compila o conjunto.            |
| `pnpm test:integration` | Executa a integração em PostgreSQL, usando `TEST_DATABASE_URL`. |
| `pnpm start`            | Serve frontend compilado e API pelo Fastify.                    |

Instale dependências no pacote que as utiliza, por exemplo `pnpm --filter tcc-evasao-frontend add nome-do-pacote`. Não gere novos lockfiles dentro dos pacotes.

## Testes com PostgreSQL

### Testar manualmente com dados sintéticos

Com o Docker Desktop aberto, execute na raiz:

```powershell
pnpm dev:demo
```

O comando sobe um PostgreSQL isolado no projeto Docker `tcc-demo`, porta `55433`, carrega as fixtures, prepara o usuário de leitura e inicia React e Fastify. Pare servidores anteriores para liberar as portas `3000` e `5173`. As configurações são passadas apenas aos processos iniciados, sem editar `backend/.env`.

Abra [a interface](http://127.0.0.1:5173/) ou [o Swagger](http://127.0.0.1:5173/docs/). Selecione **2022** para ver 1.000 vínculos, 800 matrículas, 100 ingressantes, 200 concluintes e taxas de evasão de 10% (curso) e 9% (IES). O ano 2023 inclui ruído e medidas incompletas; 2024 contém apenas docentes e deve aparecer sem dados de alunos.

- `pnpm db:demo`: sobe e carrega somente a base, sem iniciar a aplicação.
- `pnpm dev:demo`: prepara a base e inicia front e back conectados a ela.
- `pnpm db:demo:auth`: prepara Gold, schema `app`, permissões e administrador, sem iniciar os servidores.
- `pnpm dev:demo:auth`: faz essa preparação e inicia front e back com autenticação habilitada.
- `pnpm db:demo:down`: encerra o banco de demonstração e descarta seus dados.

**Cada execução de `db:demo` ou `dev:demo` recria a Gold sintética dessa demonstração.** Não armazene dados reais nesse container. O banco usa memória temporária; depois de encerrá-lo, os comandos acima fazem a carga novamente. `Ctrl+C` encerra a aplicação; use `db:demo:down` para encerrar também o banco.

Credenciais exclusivamente locais: banco `postgres`, usuário de leitura `tcc_demo`, senha `tcc_demo_local`. O banco da pipeline e o container dos testes de integração são independentes.

### Testar a autenticação na demonstração

Com Docker Desktop aberto e as portas `3000` e `5173` livres, execute em um terminal interativo:

```sh
pnpm dev:demo:auth
```

O comando cria as roles técnicas de manutenção e autenticação, prepara `app`, executa as migrações reais do backend e aplica as permissões. Na primeira execução, pede senha e confirmação para **`admin@demo.local`** (15 a 128 caracteres, entrada oculta). Não há senha padrão de administrador. Nas próximas execuções, preserva a senha, o estado e as permissões dessa conta. A Gold sintética continua sendo recarregada.

No painel, em [http://127.0.0.1:5173/](http://127.0.0.1:5173/):

1. Clique em **Entrar** e informe `admin@demo.local` e a senha cadastrada. O cabeçalho passa a mostrar **Alterar senha** e **Sair**.
2. Recarregue a página: a sessão é restaurada pelo cookie, sem novo login.
3. Em **Alterar senha**, informe a senha atual e uma nova. As outras sessões da conta são encerradas; esta continua.
4. Clique em **Sair**. Outras abas abertas do painel também saem.

Use sempre `127.0.0.1`: em `localhost` a origem é outra e o login responde que não está disponível neste endereço.

Pelo Swagger:

1. Abra [Swagger pelo Vite](http://127.0.0.1:5173/docs/). Use esse endereço: a origem da demonstração autenticada é `http://127.0.0.1:5173`.
2. Em **Autenticação → POST /api/v1/autenticacao/login**, envie `email: admin@demo.local`, a senha cadastrada e `X-CSRF-Protection: 1`. O navegador envia `Origin` automaticamente.
3. Copie o `access_token` retornado para **Authorize**, sem escrever `Bearer`. Consulte **GET /api/v1/autenticacao/me**: deve retornar o e-mail e as duas permissões de ETL.
4. Execute **POST /api/v1/autenticacao/renovar** com `X-CSRF-Protection: 1`. O navegador envia o cookie; copie o novo JWT para **Authorize**.
5. Execute **POST /api/v1/autenticacao/logout** com o mesmo header. Uma nova chamada a `/me` deve receber `401`, inclusive usando o último JWT.

As consultas de filtros, resumo, evolução temporal e comparações continuam disponíveis sem autenticação.

Não é necessário editar `.env`, instalar `psql` localmente ou alterar o Compose da pipeline. O destino é fixo: projeto Docker `tcc-demo`, banco `postgres`, porta `55433`. O segredo JWT é aleatório e existe somente no processo iniciado; ao reiniciar o comando, JWTs anteriores deixam de valer. Faça login novamente ou renove a sessão pelo cookie ainda válido. `pnpm dev:demo` continua iniciando somente o painel público, com autenticação desabilitada, independentemente do `.env`.

`Ctrl+C` encerra os servidores e preserva o banco enquanto o contêiner continuar rodando. **`pnpm db:demo:down` ou parar o contêiner apaga o armazenamento temporário, incluindo o administrador.** Execute `pnpm dev:demo:auth` novamente para recriar tudo e definir uma nova senha. Isso também permite reiniciar a demonstração se esquecer a senha, descartando somente seus dados sintéticos.

As roles `tcc_demo_owner` e `tcc_demo_auth` usam credenciais técnicas fixas exclusivamente para esse banco local descartável. O backend usa a role restrita de autenticação, nunca a de manutenção. Para o banco compartilhado com a pipeline, siga o [procedimento de preparação do schema app](docs/arquitetura/BANCO_APLICACAO.md), com credenciais próprias.

### Testes automatizados

Os testes usam banco e usuário temporários com dados sintéticos, independentes dos dados da pipeline:

```powershell
docker compose -f backend/test/compose.yml up -d --wait
$env:TEST_DATABASE_URL = 'postgresql://postgres:tcc_test@127.0.0.1:55432/postgres'
pnpm test:integration
```

O PostgreSQL de teste usa armazenamento em memória. Se precisar de outro container isolado, escolha um nome de projeto Compose e uma porta por `TEST_POSTGRES_PORT`. Não encerre o container enquanto estiver usando seus dados em uma sessão manual. Os testes de integração criam e removem apenas seus próprios bancos e roles, e não deixam uma base de demonstração carregada para a interface.

O workflow do GitHub Actions está configurado para executar `pnpm check` e a integração com PostgreSQL 17 em PRs para `main` e após pushes em `main`. Consulte a aba Actions para verificar o resultado de cada execução. O [guia de validação](docs/operacao/VALIDACAO.md) separa os testes sintéticos da conferência com a Gold real.

## Colaboração

A [proteção da API pública](docs/operacao/SEGURANCA_API.md) documenta cabeçalhos de segurança, limites HTTP e a cota de consultas configurável por `HTTP_RATE_LIMIT_MAX`. O painel permanece público; o [acesso administrativo](docs/arquitetura/AUTORIZACAO.md) usa login próprio, ainda sem telas de administração do ETL.

Use uma branch curta por tarefa, PR para `main` e Conventional Commits em português. O [guia de contribuição](CONTRIBUTING.md) explica nomes de branches, commits, revisão e a primeira publicação. Frontend e backend pertencem ao mesmo repositório; a pipeline permanece separada.
