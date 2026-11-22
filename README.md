# Aplicação de análise da evasão em Mato Grosso

Monorepo com React, TypeScript e Fastify. O frontend consulta a API, e o backend lê os indicadores da Gold no PostgreSQL. A [pipeline Python](https://github.com/TCC-EvasaoMT/Pipeline-TCC) continua em seu próprio repositório, alimentando o banco de forma independente.

## Organização

```text
frontend/              React e Vite; resumo, filtros e gráfico de evolução temporal
backend/               API Fastify, regras de cálculo e acesso à Gold
backend/src/modules/   Módulos de catálogos, indicadores e análises
backend/src/plugins/   Recursos compartilhados e saúde da API
docs/                  Documentação da aplicação e da arquitetura
.github/               CI e modelo de pull request
pnpm-workspace.yaml    Pacotes do workspace
pnpm-lock.yaml         Único lockfile da aplicação
```

O backend é um monólito modular: catálogos, indicadores e análises são plugins encapsulados do Fastify, cada um com entrada pública em `index.ts`. O catálogo continua acessível em `/api/v1/filtros`. Novos módulos serão adicionados quando houver funcionalidades que justifiquem a separação.

Leia a [arquitetura da aplicação](docs/ARQUITETURA.md), os [módulos e contratos do backend](docs/MODULOS_BACKEND.md) e os [filtros e fluxo da interface](docs/FRONTEND_FILTROS.md). A pasta local `docs-codex/` permanece ignorada pelo Git.

O frontend não importa arquivos internos do backend e não acessa o banco. Ele usa HTTP/JSON em `/api/v1`. As fórmulas de evasão continuam no backend; a interface apenas formata os resultados.

A interface organiza filtros compartilhados, resumo anual e evolução temporal. O ano fica junto ao resumo; o gráfico mantém seu próprio período. O tema usa Source Sans 3 servida localmente, duas taxas com igual destaque e totais em uma faixa compacta. A seção **Como interpretar os dados** reúne as explicações metodológicas.

A [API de evolução temporal](docs/ANALISES_TEMPORAIS.md) permite consultar séries anuais em `/api/v1/analises/evolucao-temporal`, com intervalo inclusivo de até 30 anos e os mesmos filtros de recorte. O [módulo de análises do frontend](docs/FRONTEND_ANALISES.md) apresenta as duas taxas em um gráfico Recharts e uma tabela de valores e qualidade por ano. A interface utiliza Bootstrap 5.3 para formulários, botões, grade responsiva e tabela, com CSS próprio para a identidade visual, conforme a [documentação de estilização](docs/FRONTEND_ESTILIZACAO.md).

## Executar em desenvolvimento

Requisitos: Node.js 22.13 ou superior (validado com Node 24), pnpm 11.25.0 e PostgreSQL 17 com a Gold carregada. Para instalar o gerenciador, use `npm install --global pnpm@11.25.0`.

Execute na raiz do repositório:

```powershell
pnpm install --frozen-lockfile
```

Se `backend/.env` ainda não existir, crie-o a partir de `backend/.env.example` e configure o usuário de leitura do banco. A [documentação do backend](backend/README.md) explica as permissões e a carga da Gold. Uma configuração local já existente é preservada ao migrar para o monorepo.

O painel continua público. O backend também oferece [autenticação administrativa JWT/Bearer](docs/AUTORIZACAO.md), habilitada por configuração. O [guia do banco da aplicação](docs/BANCO_APLICACAO.md) explica a criação do schema `app`, migrações e primeiro administrador no PostgreSQL existente, sem alterar a pipeline. A tela de login será implementada em outro incremento.

Pare os servidores antigos antes de iniciar o conjunto, para liberar as portas 3000 e 5173:

```powershell
pnpm dev
```

- Frontend: [http://127.0.0.1:5173/](http://127.0.0.1:5173/).
- Swagger pelo frontend: [http://127.0.0.1:5173/docs/](http://127.0.0.1:5173/docs/).
- API diretamente: [http://127.0.0.1:3000/health](http://127.0.0.1:3000/health).

O comando inicia os dois pacotes. O Vite encaminha `/api`, `/health` e `/docs` para o Fastify, usando a porta `PORT` de `backend/.env` ou do terminal. Apenas a porta é lida pela configuração do Vite; credenciais do banco não são expostas ao navegador. A interface e a API escutam somente em `127.0.0.1`.

A tela inicial exibe vínculos, matrículas, ingressantes, concluintes e taxas de evasão. Permite combinar ano, curso, área CINE, modalidade, categoria administrativa, organização acadêmica e municípios de oferta e sede. Os filtros são aplicados automaticamente; limpar mantém o ano e atualizar preserva as seleções ainda disponíveis. O gráfico temporal usa os mesmos filtros opcionais e um intervalo próprio, independente do ano do resumo. Mostra estados de carregamento, erro, ausência de dados e qualidade. Ela utiliza a base conectada, sem injetar números fictícios no frontend. Comparações entre cursos e grupos ficam para os próximos incrementos.

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
- `pnpm db:demo:down`: encerra o banco de demonstração e descarta seus dados.

**Cada execução de `db:demo` ou `dev:demo` recria a Gold sintética dessa demonstração.** Não armazene dados reais nesse container. O banco usa memória temporária; depois de encerrá-lo, os comandos acima fazem a carga novamente. `Ctrl+C` encerra a aplicação; use `db:demo:down` para encerrar também o banco.

Credenciais exclusivamente locais: banco `postgres`, usuário de leitura `tcc_demo`, senha `tcc_demo_local`. O banco da pipeline e o container dos testes de integração são independentes.

### Testes automatizados

Os testes usam banco e usuário temporários com dados sintéticos, independentes dos dados da pipeline:

```powershell
docker compose -f backend/test/compose.yml up -d --wait
$env:TEST_DATABASE_URL = 'postgresql://postgres:tcc_test@127.0.0.1:55432/postgres'
pnpm test:integration
```

O PostgreSQL de teste usa armazenamento em memória. Se precisar de outro container isolado, escolha um nome de projeto Compose e uma porta por `TEST_POSTGRES_PORT`. Não encerre o container enquanto estiver usando seus dados em uma sessão manual. Os testes de integração criam e removem apenas seus próprios bancos e roles, e não deixam uma base de demonstração carregada para a interface.

O GitHub Actions executará `pnpm check` e a integração com PostgreSQL 17 em PRs para `main` e após pushes em `main`. O workflow está preparado; sua primeira execução no GitHub ocorre depois da publicação do repositório.

## Colaboração

A [proteção da API pública](docs/SEGURANCA_API.md) documenta cabeçalhos de segurança, limites HTTP e a cota de consultas configurável por `HTTP_RATE_LIMIT_MAX`. O painel permanece público; o [acesso administrativo](docs/AUTORIZACAO.md) será implementado separadamente.

Use uma branch curta por tarefa, PR para `main` e Conventional Commits em português. O [guia de contribuição](CONTRIBUTING.md) explica nomes de branches, commits, revisão e a primeira publicação. Frontend e backend pertencem ao mesmo repositório; a pipeline permanece separada.
