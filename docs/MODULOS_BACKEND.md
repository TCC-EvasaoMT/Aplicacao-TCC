# Módulos e contratos do backend

O backend usa um **monólito modular com organização por funcionalidade**, separando HTTP, acesso a dados e regras de negócio. Para entender o motivo dessa escolha, o fluxo de uma requisição, o papel de cada arquivo, a comunicação entre módulos e a injeção de dependências, consulte a [explicação da arquitetura](ARQUITETURA.md#arquitetura-adotada-no-backend). Este documento detalha os contratos e as responsabilidades de cada módulo.

## Catálogos

`backend/src/modules/catalogos` fornece `GET /api/v1/filtros`. A URL e o formato da resposta foram preservados na separação do módulo; no Swagger, a rota aparece em **Catálogos**.

`index.ts` exporta o plugin `catalogos`, a fábrica `criarConsultasCatalogos` e o tipo de suas consultas. `rotas.ts` define o contrato HTTP, `schemas.ts` define a resposta e `consultas.ts` busca as opções na Gold.

O catálogo contém anos, cursos, áreas gerais CINE, municípios de oferta e sede, modalidades, categorias administrativas e organizações acadêmicas. Códigos são textos e preservam zeros iniciais. Os anos vêm de registros presentes na fato de cursos. Opções com código nulo são omitidas; nomes podem ser nulos.

O catálogo é global, não recebe filtros e não é reduzido conforme a seleção da interface. Assim, uma combinação válida de opções pode não encontrar registros. Não há cadastro ou edição dessas opções pela API.

## Indicadores

`backend/src/modules/indicadores` fornece `GET /api/v1/indicadores/resumo`. Recebe um ano obrigatório e até sete filtros opcionais, com um valor por parâmetro e combinação por **E**.

`index.ts` exporta o plugin `indicadores`, a fábrica `criarConsultasIndicadores` e o tipo de suas consultas. `rotas.ts` coordena a consulta e o cálculo; `schemas.ts` valida entrada e resposta; `consultas.ts` agrega as medidas usando parâmetros SQL; `calculos.ts` calcula taxas e sinalizações de qualidade.

As taxas usam os totais agregados, nunca a média das taxas dos cursos. Valores ausentes não viram zero, e ruído negativo ou decimal é preservado. Consulte as fórmulas e regras completas no [README do backend](../backend/README.md#cálculos-e-qualidade).

O `index.ts` também expõe o contrato de cálculo, os schemas de recorte e resultado, a projeção de agregação SQL e a parametrização dos filtros. Análises derivadas devem usar essa entrada pública para manter as mesmas fórmulas e regras de qualidade, sem importar arquivos internos de indicadores. Os fragmentos SQL pressupõem os aliases das junções definidas em `plugins/gold.ts`; os módulos consumidores definem o agrupamento e o período.

## Análises

`backend/src/modules/analises` fornece `GET /api/v1/analises/evolucao-temporal`, com `ano_inicial`, `ano_final` e os mesmos sete filtros opcionais do resumo. Retorna uma série crescente de até 30 anos, incluindo lacunas com medidas `null`.

`index.ts` exporta o plugin `analises`, a fábrica `criarConsultasAnalises` e o tipo de consultas. `consultas.ts` agrega por ano; `evolucao.ts` completa lacunas e usa as regras públicas de indicadores; `rotas.ts` e `schemas.ts` definem o contrato HTTP. Veja [contrato, exemplos e validação da evolução temporal](ANALISES_TEMPORAIS.md). Comparações e rankings ainda não estão implementados.

## Operação e composição

`GET /health` pertence a `plugins/health.ts` e verifica a leitura da fato e das seis dimensões. `plugins/gold.ts` converte falhas de consulta em `GOLD_INDISPONIVEL`; o tratamento global responde `503` sem expor credenciais ou SQL. Validações inválidas retornam `400`.

`server.ts` cria um único pool PostgreSQL e injeta dependências separadas em `buildApp`: `catalogos`, `indicadores`, `analises` e `health`. Os testes HTTP podem substituir cada dependência sem conectar um banco. `app.ts` registra os plugins encapsulados e a documentação. Nenhum módulo importa arquivos internos de outro; análises usa o contrato público de indicadores.

`plugins/seguranca.ts` registra cabeçalhos de segurança e uma cota compartilhada pelas rotas `/api`, antes de executar os módulos. O limite retorna `429` com `Retry-After`, também documentado no Swagger. `app.ts` preserva erros HTTP conhecidos e aplica limites de corpo e recebimento. Veja [configuração e limites da proteção HTTP](SEGURANCA_API.md).

`plugins/logs.ts` restringe os campos dos logs e correlaciona resposta e evento pelo `X-Request-Id` gerado no servidor. Os eventos de conclusão incluem rota, status e duração, sem URLs completas ou credenciais. Logs de falhas da Gold passam pela mesma normalização de códigos.

## Como adicionar um módulo

1. Crie a pasta em `modules/` quando houver uma funcionalidade concreta.
2. Mantenha rotas, schemas, consultas e regras específicas dentro dela.
3. Exporte o plugin e as dependências necessárias pelo `index.ts`.
4. Registre-o em `app.ts` e componha suas consultas em `server.ts`.
5. Teste o contrato HTTP e, se houver SQL, a integração com PostgreSQL sintético.
6. Atualize esta documentação junto da implementação, no mesmo commit.

Para verificar os contratos existentes, use `pnpm check` e a integração descrita no README. Ela cobre catálogo, filtros combinados, códigos com zeros iniciais, diferenças entre sede e oferta, ausência de dados e recuperação após reconstrução da Gold e reaplicação dos grants.
