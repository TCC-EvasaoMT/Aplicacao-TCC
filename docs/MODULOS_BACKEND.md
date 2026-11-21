# Módulos e contratos do backend

## Catálogos

`backend/src/modules/catalogos` fornece `GET /api/v1/filtros`. A URL e o formato da resposta foram preservados na separação do módulo; no Swagger, a rota aparece em **Catálogos**.

`index.ts` exporta o plugin `catalogos`, a fábrica `criarConsultasCatalogos` e o tipo de suas consultas. `rotas.ts` define o contrato HTTP, `schemas.ts` define a resposta e `consultas.ts` busca as opções na Gold.

O catálogo contém anos, cursos, áreas gerais CINE, municípios de oferta e sede, modalidades, categorias administrativas e organizações acadêmicas. Códigos são textos e preservam zeros iniciais. Os anos vêm de registros presentes na fato de cursos. Opções com código nulo são omitidas; nomes podem ser nulos.

O catálogo é global, não recebe filtros e não é reduzido conforme a seleção da interface. Assim, uma combinação válida de opções pode não encontrar registros. Não há cadastro ou edição dessas opções pela API.

## Indicadores

`backend/src/modules/indicadores` fornece `GET /api/v1/indicadores/resumo`. Recebe um ano obrigatório e até sete filtros opcionais, com um valor por parâmetro e combinação por **E**.

`index.ts` exporta o plugin `indicadores`, a fábrica `criarConsultasIndicadores` e o tipo de suas consultas. `rotas.ts` coordena a consulta e o cálculo; `schemas.ts` valida entrada e resposta; `consultas.ts` agrega as medidas usando parâmetros SQL; `calculos.ts` calcula taxas e sinalizações de qualidade.

As taxas usam os totais agregados, nunca a média das taxas dos cursos. Valores ausentes não viram zero, e ruído negativo ou decimal é preservado. Consulte as fórmulas e regras completas no [README do backend](../backend/README.md#cálculos-e-qualidade).

## Operação e composição

`GET /health` pertence a `plugins/health.ts` e verifica a leitura da fato e das seis dimensões. `plugins/gold.ts` converte falhas de consulta em `GOLD_INDISPONIVEL`; o tratamento global responde `503` sem expor credenciais ou SQL. Validações inválidas retornam `400`.

`server.ts` cria um único pool PostgreSQL e injeta dependências separadas em `buildApp`: `catalogos`, `indicadores` e `health`. Os testes HTTP podem substituir cada dependência sem conectar um banco. `app.ts` registra os plugins encapsulados e a documentação. Nenhum módulo depende das consultas internas de outro.

## Como adicionar um módulo

1. Crie a pasta em `modules/` quando houver uma funcionalidade concreta.
2. Mantenha rotas, schemas, consultas e regras específicas dentro dela.
3. Exporte o plugin e as dependências necessárias pelo `index.ts`.
4. Registre-o em `app.ts` e componha suas consultas em `server.ts`.
5. Teste o contrato HTTP e, se houver SQL, a integração com PostgreSQL sintético.
6. Atualize esta documentação junto da implementação, no mesmo commit.

Para verificar os contratos existentes, use `pnpm check` e a integração descrita no README. Ela cobre catálogo, filtros combinados, códigos com zeros iniciais, diferenças entre sede e oferta, ausência de dados e recuperação após reconstrução da Gold e reaplicação dos grants.
