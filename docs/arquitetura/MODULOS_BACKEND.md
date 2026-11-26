# Módulos e contratos do backend

O backend organiza HTTP, consultas e regras de negócio por funcionalidade. Este guia descreve os contratos de cada módulo; a [arquitetura](ARQUITETURA.md#arquitetura-adotada-no-backend) explica a composição, as dependências e o caminho de uma requisição.

## Catálogos

`backend/src/modules/catalogos` fornece `GET /api/v1/filtros`. No Swagger, a rota aparece em **Catálogos**.

`index.ts` exporta o plugin `catalogos`, a fábrica `criarConsultasCatalogos` e o tipo de suas consultas. `rotas.ts` define o contrato HTTP, `schemas.ts` define a resposta e `consultas.ts` busca as opções na Gold.

O catálogo contém anos, cursos, áreas gerais CINE, municípios de oferta e sede, modalidades, categorias administrativas e organizações acadêmicas. Códigos são textos e preservam zeros iniciais. Os anos vêm de registros presentes na fato de cursos. Opções com código nulo são omitidas; nomes podem ser nulos.

O catálogo é global, não recebe filtros e não é reduzido conforme a seleção da interface. Assim, uma combinação válida de opções pode não encontrar registros. Não há cadastro ou edição dessas opções pela API.

## Indicadores

`backend/src/modules/indicadores` fornece `GET /api/v1/indicadores/resumo`. Recebe um ano obrigatório e até sete filtros opcionais, com um valor por parâmetro e combinação por **E**.

`index.ts` exporta o plugin `indicadores`, a fábrica `criarConsultasIndicadores` e o tipo de suas consultas. `rotas.ts` coordena a consulta e o cálculo; `schemas.ts` valida entrada e resposta; `consultas.ts` agrega as medidas usando parâmetros SQL; `calculos.ts` calcula taxas e sinalizações de qualidade.

As taxas usam os totais agregados, nunca a média das taxas dos cursos. Valores ausentes não viram zero, e ruído negativo ou decimal é preservado. Consulte as fórmulas e regras completas no [README do backend](../../backend/README.md#cálculos-e-qualidade).

O `index.ts` também expõe o contrato de cálculo, os schemas de recorte e resultado, a projeção de agregação SQL e a parametrização dos filtros. Análises derivadas devem usar essa entrada pública para manter as mesmas fórmulas e regras de qualidade, sem importar arquivos internos de indicadores. Os fragmentos SQL pressupõem os aliases das junções definidas em `plugins/gold.ts`; os módulos consumidores definem o agrupamento e o período.

## Análises

`backend/src/modules/analises` fornece `GET /api/v1/analises/evolucao-temporal`, com `ano_inicial`, `ano_final` e os mesmos sete filtros opcionais do resumo. Retorna uma série crescente de até 30 anos, incluindo lacunas com medidas `null`.

Para o RF10, `GET /api/v1/analises/dispersao` devolve todos os cursos de um ano, a linha de alta evasão de cada taxa e a zona crítica; `dispersao.ts` concentra essa regra. Veja o [contrato da dispersão](../api/DISPERSAO.md).

Para o RF12, `GET /api/v1/analises/ranking` devolve todas as áreas gerais ou modalidades de um ano, classificadas pela taxa escolhida; `ranking.ts` decide empates, bases pequenas e ausências. Veja o [contrato do ranking](../api/RANKING.md).

`GET /api/v1/analises/perfil` lê `fato_evasao_perfil` e `dim_perfil` para os 12 fatores de prioridade 1; `perfil.ts` guarda a lista dos fatores e monta as categorias com `calcularResumo`. As junções com as dimensões do curso vêm de `plugins/gold.ts` (`origemPerfil`). Veja o [contrato do perfil](../api/PERFIL.md).

O módulo também fornece `GET /api/v1/analises/comparacoes`, com `ano` e `agrupar_por` obrigatórios. Compara até 20 grupos por curso, área geral CINE, municípios de oferta/sede, modalidade, categoria administrativa ou organização acadêmica. Aceita os sete filtros opcionais e seleção de grupos por códigos/textos. Retorna totais, taxas e qualidade por grupo, quantidade total de grupos e indicação de truncamento. Veja [contrato e exemplos das comparações](../api/COMPARACOES.md).

`index.ts` exporta o plugin `analises`, a fábrica `criarConsultasAnalises` e o tipo de consultas, com as operações `evolucao`, `comparacao`, `dispersao`, `ranking` e `perfil`. `consultas.ts` agrega por ano ou grupo; `evolucao.ts` completa lacunas; `comparacoes.ts` define as dimensões permitidas e monta os resultados. Ambos reutilizam o cálculo público de indicadores. `rotas.ts` e `schemas.ts` definem os contratos HTTP. Consulte a [API de evolução temporal](../api/ANALISES_TEMPORAIS.md) e as [comparações na interface](../frontend/COMPARACOES.md). As rotas de análise são públicas.

## Autenticação

`backend/src/modules/autenticacao` implementa login, renovação, logout, consulta de identidade e troca da própria senha em `/api/v1/autenticacao`. `rotas.ts` coordena HTTP e cookies; `schemas.ts` define contratos; `senhas.ts` trata Argon2id; `repositorio.ts` concentra o SQL e as transações de sessão; `acesso.ts` valida Bearer, aplica permissões consultadas no banco e expõe `request.identidade` e `request.sessaoId` às rotas. Sua entrada pública exporta o registro de rotas, o controle transversal e a fábrica do repositório.

O módulo usa exclusivamente o schema `app`, com outra role de conexão. `database/` contém as migrações e o provisionamento de administrador, executados fora do servidor HTTP. Veja [contrato de autenticação](AUTORIZACAO.md) e [preparação do banco](BANCO_APLICACAO.md). Nenhuma rota de ETL está implementada; os testes registram rotas próprias para verificar `etl:consultar` e `etl:reprocessar`.

## Operação e composição

`GET /health` pertence a `plugins/health.ts` e verifica a leitura da fato e das seis dimensões. `plugins/gold.ts` converte falhas de consulta em `GOLD_INDISPONIVEL`; o tratamento global responde `503` sem expor credenciais ou SQL. Validações inválidas retornam `400`.

`server.ts` cria um pool de leitura da Gold e, quando a autenticação está habilitada, outro pool restrito ao schema `app`. Injeta dependências separadas em `buildApp`: `catalogos`, `indicadores`, `analises`, `health` e `autenticacao` opcional. Os testes HTTP podem substituir cada dependência sem conectar um banco. `app.ts` registra o controle de acesso antes dos módulos e a documentação antes das rotas. Análises usa o contrato público de indicadores.

`plugins/seguranca.ts` registra cabeçalhos de segurança e uma cota compartilhada pelas rotas `/api`, antes de executar os módulos. O limite retorna `429` com `Retry-After`, também documentado no Swagger. `app.ts` preserva erros HTTP conhecidos e aplica limites de corpo e recebimento. Veja [configuração e limites da proteção HTTP](../operacao/SEGURANCA_API.md).

`plugins/logs.ts` restringe os campos dos logs e correlaciona resposta e evento pelo `X-Request-Id` gerado no servidor. Os eventos de conclusão incluem rota, status e duração, sem URLs completas ou credenciais. Logs de falhas da Gold passam pela mesma normalização de códigos.

## Como adicionar um módulo

1. Crie a pasta em `modules/` quando houver uma funcionalidade concreta.
2. Mantenha rotas, schemas, consultas e regras específicas dentro dela.
3. Exporte o plugin e as dependências necessárias pelo `index.ts`.
4. Registre-o em `app.ts`, componha suas consultas em `server.ts` e declare `config.acesso` em cada rota `/api/`: pública, autenticada ou com a permissão exigida.
5. Teste o contrato HTTP e, se houver SQL, a integração com PostgreSQL sintético.
6. Atualize esta documentação junto da implementação, no mesmo commit.

Para verificar os contratos existentes, use `pnpm check` e a integração descrita no README. Ela cobre catálogo, filtros combinados, códigos com zeros iniciais, diferenças entre sede e oferta, ausência de dados e recuperação após reconstrução da Gold e reaplicação dos grants.
