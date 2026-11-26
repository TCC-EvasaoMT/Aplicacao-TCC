# Arquitetura da aplicação

A aplicação é um monorepo com dois pacotes: `frontend` (React/Vite) e `backend` (Fastify). O backend é um monólito modular: os módulos compartilham o mesmo processo e banco, mas cada um possui suas rotas, consultas e contratos. A pipeline Python tem repositório e execução independentes.

No frontend, PrimeReact 10 fornece os controles interativos (botões, listas, campos, caixas de marcação, mensagens, painéis recolhíveis, gavetas e abas) em modo sem estilo, e Tailwind CSS 4 define layout e aparência a partir dos tokens de `styles.css`; Recharts apresenta as séries temporais, as comparações entre grupos e a dispersão por curso. A configuração compartilhada dos componentes fica em `src/lib`, e React mantém o controle do estado e dos eventos. Veja [Estilização do frontend](../frontend/ESTILIZACAO.md) para a organização e os limites dessa integração.

## Arquitetura adotada no backend

O backend é um monólito modular organizado por funcionalidade. Cada módulo separa entrada HTTP, consultas SQL e regras de negócio. A composição recebe as dependências como argumentos.

Todos os módulos executam na mesma aplicação Fastify e são compilados e implantados juntos. Os módulos de consulta compartilham um pool de leitura da Gold; a autenticação usa um segundo pool no mesmo PostgreSQL, com credenciais restritas ao schema `app`. Esse é o limite do monólito.

O código se divide por responsabilidade do negócio. Cada módulo concentra rotas, contratos, consultas e regras específicas, com uma entrada pública em `index.ts`. Uma mudança na evolução temporal, por exemplo, começa em `modules/analises`.

Monorepo descreve a organização do repositório: frontend e backend pertencem ao mesmo workspace pnpm. O React é um cliente HTTP/JSON da API. No modo compilado, o Fastify também entrega seus arquivos estáticos.

A pipeline é externa à aplicação e mantém repositório e execução próprios. A [matriz do TCC](../tcc/RASTREABILIDADE.md) compara essa implementação local com a infraestrutura em nuvem prevista no trabalho.

### Relação com outros estilos de arquitetura

O projeto **não implementa integralmente Clean Architecture nem arquitetura hexagonal**. Existem funções de cálculo independentes do framework e do banco, mas não há uma estrutura completa de entidades, casos de uso, portas e adaptadores. As consultas usam `pg` diretamente, e as rotas coordenam a consulta e o processamento do resultado.

Também não há camadas obrigatórias de classes `Controller`, `Service` e `Repository`. `rotas.ts` cumpre a função de entrada e coordenação HTTP; `consultas.ts` concentra a leitura do banco; funções específicas executam as regras. Essa separação pode evoluir quando um fluxo concreto precisar de coordenação mais complexa, sem adicionar camadas vazias antecipadamente.

```mermaid
flowchart LR
  S[SEDAP+ e referências] --> P[Pipeline Python]
  P --> G[(PostgreSQL / Gold)]
  G --> B[API Fastify / leitura]
  B --> F[Interface React]
  B <--> A[(PostgreSQL / app: contas e sessões)]
```

## Execução

Em desenvolvimento, `pnpm dev` inicia Fastify na porta 3000 e Vite na 5173. O navegador usa caminhos relativos; o Vite encaminha `/api`, `/health` e `/docs` ao backend. Em `pnpm build` seguido de `pnpm start`, o Fastify serve também os arquivos compilados do React. `NODE_ENV=production` desativa o Swagger.

`pnpm dev:demo` prepara um PostgreSQL separado na porta 55433, carrega as fixtures e inicia os dois pacotes usando um login de leitura. Cada execução recria a Gold sintética desse container. O comando não altera o `.env` nem prepara o banco da pipeline.

`pnpm dev:demo:auth` acrescenta a preparação de `app` com as mesmas migrações e grants do backend, provisiona o administrador se ausente e inicia os servidores com autenticação habilitada e origem `http://127.0.0.1:5173`. Repetir a preparação preserva contas e permissões. O segredo JWT é gerado em memória a cada execução.

## Limites de responsabilidade

- A pipeline extrai, transforma e grava dados; a API não executa essas etapas.
- A API valida os parâmetros, agrega medidas em SQL e calcula taxas sobre os totais.
- O frontend consulta HTTP/JSON e formata os resultados. Não importa código do backend, não acessa o PostgreSQL e não recalcula taxas.
- Cada módulo do backend expõe um `index.ts`. A composição da aplicação usa essas entradas; módulos não importam arquivos internos uns dos outros.
- `plugins/` reúne acesso compartilhado à Gold, saúde, proteção HTTP, logs e contratos de erro. `config/` valida o ambiente. Os pools e seu encerramento são coordenados em `server.ts`.
- O backend mantém migrações próprias somente de `app`, executadas por comando de manutenção. A pipeline não cria contas administrativas; a API não migra as camadas analíticas.

## Módulos existentes

| Módulo         | Responsabilidade                                                           | Entrada HTTP                                                                                   |
| -------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `catalogos`    | Listar opções disponíveis para filtros                                     | `GET /api/v1/filtros`                                                                          |
| `indicadores`  | Agregar um recorte anual e calcular seus totais, taxas e qualidade         | `GET /api/v1/indicadores/resumo`                                                               |
| `analises`     | Consultar evolução anual, comparar grupos, dispersão, ranking e perfil     | `GET /api/v1/analises/evolucao-temporal`, `/comparacoes`, `/dispersao`, `/ranking` e `/perfil` |
| `autenticacao` | Autenticar, renovar e revogar sessões, trocar a senha e aplicar permissões | `/api/v1/autenticacao/*`                                                                       |

Saúde da aplicação, tratamento de erros e documentação da API são recursos transversais. `GET /health` pertence a `plugins/health.ts`; não é uma responsabilidade do módulo de indicadores. O controle de acesso é instalado na raiz do Fastify pelo módulo de autenticação, antes das rotas, conforme o [modelo de acesso](AUTORIZACAO.md).

## Organização do backend

```text
backend/src/
  modules/
    catalogos/       Opções disponíveis para filtros
    indicadores/    Resumo, agregações e taxas
    analises/       Evolução temporal e comparações entre grupos
    autenticacao/   Login, JWT, sessões, permissões e troca de senha
  database/         Migrações de app e provisionamento por CLI
  plugins/
    gold.ts         Junções da Gold e tratamento de falhas de consulta
    health.ts       Verificação de acesso às tabelas utilizadas
    erros.ts        Schema público de erro
    seguranca.ts    Cabeçalhos HTTP e limite de requisições
    logs.ts         Campos permitidos e correlação dos logs
  config/
    index.ts        Leitura e validação de variáveis de ambiente
    autenticacao.ts Configuração da autenticação e do pool de app
  app.ts            Composição dos plugins e tratamento HTTP de erros
  frontend.ts       Serviço de arquivos estáticos e navegação da SPA
  server.ts         Pools, inicialização e encerramento do processo
```

O fragmento SQL em `plugins/gold.ts` define as junções comuns com a fato e as seis dimensões consumidas. Os módulos definem seleções, filtros e agregações. Alterações nesse fragmento afetam catálogo, resumo, evolução, comparações e saúde e devem passar pelos testes de integração.

As comparações usam essas mesmas junções, com agrupamentos definidos em uma lista interna. `consultas.ts` concentra o SQL, aplica filtros e seleção antes de agrupar e limita a lista após contar todos os grupos encontrados. `comparacoes.ts` monta a resposta reutilizando `calcularResumo`, sem médias de taxas. O contrato expõe códigos/textos das dimensões, preserva grupos nulos e sinaliza truncamento. Não acrescenta tabelas, credenciais ou outro pool ao backend. Veja [API de comparações](../api/COMPARACOES.md).

Apesar do nome da pasta, nem todo arquivo em `plugins/` é um plugin registrável do Fastify. `health.ts` exporta um plugin; `gold.ts` e `erros.ts` fornecem funções, fragmentos SQL e schemas compartilhados. O tratamento global de erros é registrado em `app.ts`.

## Organização dentro de um módulo

| Arquivo                        | Responsabilidade                                            | Exemplo atual                                                       |
| ------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------- |
| `index.ts`                     | Expor o plugin e o contrato público do módulo               | Exporta `analises` e `criarConsultasAnalises`                       |
| `rotas.ts`                     | Declarar endpoints, associar schemas e coordenar a execução | Verifica o intervalo, consulta os dados e monta a resposta temporal |
| `schemas.ts`                   | Definir contratos JSON Schema                               | Validação dos parâmetros e schema de serialização da resposta       |
| `consultas.ts`                 | Montar e executar SQL parametrizado                         | Agrega as medidas por ano em uma consulta                           |
| `calculos.ts` ou `evolucao.ts` | Executar regras específicas em funções                      | Calcula taxas ou completa os anos sem registros                     |

Os arquivos são criados conforme a responsabilidade existente: catálogos não precisa de `calculos.ts`, pois apenas lista opções. As funções de cálculo não recebem `request`, `reply` ou um pool PostgreSQL; recebem valores e devolvem resultados.

Os schemas validam a entrada e orientam a serialização da saída pelo Fastify. Eles não demonstram que uma fórmula está correta: os cálculos são verificados em testes próprios. Regras relacionais, como a ordem e o tamanho máximo de um intervalo de anos, também são verificadas pela rota antes de consultar o banco.

## Caminho de uma requisição

Exemplo: `GET /api/v1/analises/evolucao-temporal?ano_inicial=2022&ano_final=2024&codigo_curso=001`.

```mermaid
sequenceDiagram
  participant Cliente as React ou Swagger
  participant HTTP as Fastify / schemas
  participant Rota as analises / rotas.ts
  participant Consulta as analises / consultas.ts
  participant Banco as PostgreSQL / Gold
  participant Regra as evolucao.ts e cálculo de indicadores
  Cliente->>HTTP: GET com período e filtros
  HTTP->>HTTP: Validar tipos e parâmetros permitidos
  HTTP->>Rota: Executar handler
  Rota->>Rota: Verificar ordem e limite do período
  Rota->>Consulta: Consultar o recorte
  Consulta->>Banco: SQL parametrizado, agrupado por ano
  Banco-->>Consulta: Totais e metadados de qualidade
  Consulta-->>Rota: Agregados anuais
  Rota->>Regra: Completar lacunas e calcular cada ano
  Regra-->>Rota: Série temporal
  Rota-->>HTTP: Objeto de resposta
  HTTP-->>Cliente: JSON conforme o schema de saída
```

O SQL faz as somas e identifica ausências; as funções de negócio calculam as taxas sobre esses totais. O frontend recebe proporções e apenas as formata para exibição. Um ano ausente permanece sem medidas, em vez de ganhar uma contagem zero.

Se os parâmetros forem inválidos, a consulta é rejeitada com `400`. Falhas de consulta tratadas por `consultarGold` produzem `503`, sem expor SQL ou credenciais. Erros internos não classificados são tratados com `500`. A configuração desses comportamentos fica em `app.ts` e nos helpers compartilhados, enquanto cada rota define seus contratos.

## Comunicação e dependências entre módulos

A composição em `app.ts` registra cada módulo usando `app.register`. Os módulos são plugins encapsulados do Fastify: seus hooks e configurações locais podem ter escopo próprio, herdando o contexto de seus pais. Esse encapsulamento organiza a aplicação; não representa isolamento de processos nem substitui autorização. A autenticação é a exceção: instala o controle de acesso na raiz, para alcançar todas as rotas protegidas, e depois registra seus endpoints.

Quando um módulo precisa reutilizar regras de outro, importa sua **entrada pública**:

```typescript
// Dentro de modules/analises: contrato público de indicadores.
import {
	calcularResumo,
	agregacaoSQL,
	parametrizarFiltros
} from '../indicadores/index.js'
```

`analises` depende explicitamente desse contrato de `indicadores`. As taxas, a identificação de medidas incompletas e os filtros permanecem consistentes entre resumo e série temporal. Os módulos não fazem chamadas HTTP uns aos outros: a reutilização ocorre por funções no mesmo processo.

O contrato compartilhado inclui fragmentos SQL e schemas, além de cálculos. Portanto, há um acoplamento deliberado à modelagem Gold e aos aliases das junções compartilhadas. Expor funções pelo `index.ts` torna essa dependência visível, mas não torna o módulo independente do banco.

Para manter os limites:

- Importações entre módulos passam por `index.ts`; os arquivos internos podem mudar sem obrigar consumidores a conhecê-los.
- Apenas operações necessárias são exportadas; `index.ts` não precisa expor todo o conteúdo da pasta.
- Regras específicas ficam no módulo responsável; helpers transversais não devem se tornar um depósito de regras sem dono.
- Dependências devem seguir uma direção: atualmente análises reutiliza indicadores, e indicadores não depende de análises. Evite ciclos.

Essas fronteiras são convenções de organização e revisão do código. Ainda não existe uma regra de lint que bloqueie automaticamente importações de arquivos internos entre módulos.

## Injeção de dependências manual

O ponto de composição da infraestrutura é `server.ts`. Ele lê a configuração, cria **um pool de leitura da Gold e, com autenticação habilitada, um pool restrito ao schema `app`**, constrói as consultas e o repositório de autenticação e entrega essas dependências a `buildApp`. Em seguida, inicia a escuta HTTP e configura o encerramento dos pools. A credencial de migração não é usada pelo servidor.

Trecho simplificado da composição das consultas públicas, após a criação de `config` e `pool`:

```typescript
const app = await buildApp(
	{
		indicadores: criarConsultasIndicadores(pool),
		catalogos: criarConsultasCatalogos(pool),
		analises: criarConsultasAnalises(pool),
		health: criarHealth(pool)
	},
	{ docs: config.docs, logger: true }
)
```

As fábricas recebem o pool e devolvem objetos com operações como `resumo`, `filtros` e `evolucao`. `app.ts` distribui esses objetos aos plugins. As rotas usam as operações recebidas e não criam conexões por conta própria.

Isso é injeção de dependências manual: a aplicação recebe os recursos necessários como argumentos, sem usar um contêiner de DI. `buildApp` pode montar o servidor para testes sem abrir uma porta de rede ou criar um pool real.

## Como a arquitetura é testada

- **Regras de negócio:** testes chamam diretamente as funções com agregados sintéticos e verificam fórmulas, base zero, ausências, ruído e grupos pequenos.
- **Contrato HTTP:** testes constroem a aplicação com consultas substitutas e usam `app.inject` para verificar parâmetros, respostas, erros e documentação.
- **Integração:** testes conectam as fábricas de consulta a um PostgreSQL sintético e verificam SQL, grants, filtros e equivalência entre a série temporal e o resumo anual.

A integração também testa a recuperação após reconstrução da Gold e reaplicação das permissões. Essas verificações protegem as responsabilidades compartilhadas, mas não substituem a validação com dados reais nem constituem uma prova automática de todas as fronteiras arquiteturais.

## Interface e próximos módulos

O módulo `analises` oferece a API de evolução temporal e utiliza o contrato público de indicadores para manter as mesmas regras de agregação e cálculo. No frontend, `modules/analises` consulta essa API e apresenta gráfico Recharts e tabela acessível; o painel de indicadores compõe sua entrada pública e compartilha os sete filtros de recorte. Apenas tipos públicos de indicadores são importados por análises. O intervalo temporal é independente do ano do resumo e as taxas não são recalculadas no cliente.

No frontend, `modules/autenticacao` reúne o login, a restauração e a renovação da sessão e a alteração de senha, com controles no cabeçalho. Não importa outros módulos do painel. Veja [login e sessão no painel](../frontend/AUTENTICACAO.md).

A dispersão por curso (RF10) tem API e aba própria no frontend: `PainelDispersao` usa o ano e os filtros do painel, omite o filtro de curso para manter todos os cursos visíveis e alterna a taxa no eixo vertical. Veja [dispersão na interface](../frontend/DISPERSAO.md).

O ranking de áreas e modalidades (RF12) fica no topo da aba Comparação: `PainelRanking` consulta as duas dimensões com a mesma taxa e mostra as tabelas juntas. Cada tabela omite o filtro da própria dimensão e destaca a categoria filtrada. Veja [ranking na interface](../frontend/RANKING.md).

O perfil de quem evade fica na aba Resumo, abaixo dos cartões: `PainelPerfil` consulta um fator por vez com o ano e os filtros do painel e mostra as categorias na ordem do catálogo, com o texto de associação e a ressalva dos fatores circulares. Veja [perfil na interface](../frontend/PERFIL.md).

Comparações entre cursos e grupos institucionais estão implementadas na API e no frontend de análises. `PainelComparacoes` recebe catálogo, filtros e ano do resumo; mantém rascunho e seleção aplicada próprios, consulta cancelável, gráfico e tabela. O frontend omite o filtro da dimensão agrupada para manter os outros grupos visíveis; essa regra não modifica a API. Veja [comparações na interface](../frontend/COMPARACOES.md).

A Gold consumida não fornece nomes ou siglas de IES nem identificadores institucionais permanentes para comparação individual. Administração do ETL depende de um contrato externo para execuções e reprocessamentos. A proteção HTTP, os logs e a autenticação já estão na aplicação; as rotas do ETL e a integração com monitoramento externo estão pendentes. Os módulos futuros serão criados junto de suas funcionalidades.

## Documentação relacionada

O [modelo de autorização](AUTORIZACAO.md) mantém o painel público e a administração autenticada: JWT/Bearer, renovação por cookie e consulta de sessão e permissões a cada chamada protegida. A [preparação do schema app](BANCO_APLICACAO.md) usa migrações e roles distintas das camadas analíticas.

- [Módulos e contratos do backend](MODULOS_BACKEND.md)
- [Filtros e fluxo da interface](../frontend/FILTROS.md)
- [API de evolução temporal](../api/ANALISES_TEMPORAIS.md)
- [Evolução temporal na interface](../frontend/ANALISES.md)
- [API de comparações](../api/COMPARACOES.md)
- [API de dispersão por curso](../api/DISPERSAO.md)
- [API de ranking de áreas e modalidades](../api/RANKING.md)
- [API de perfil de quem evade](../api/PERFIL.md)
- [Comparações na interface](../frontend/COMPARACOES.md)
- [Estado e exportação](../frontend/ESTADO_E_EXPORTACAO.md)
- [Interatividade e filtragem cruzada](../frontend/INTERATIVIDADE.md)
- [Acesso ao painel e à administração](AUTORIZACAO.md)
- [Banco da aplicação](BANCO_APLICACAO.md)
- [Login e sessão no painel](../frontend/AUTENTICACAO.md)
- [Execução, permissões e fórmulas](../../backend/README.md)
- [Comandos do monorepo](../../README.md)
- [Branches, commits e revisões](../../CONTRIBUTING.md)
