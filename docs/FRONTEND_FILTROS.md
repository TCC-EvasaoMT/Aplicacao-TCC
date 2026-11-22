# Filtros e fluxo da interface

## Como utilizar

Execute `pnpm dev:demo` na raiz, com Docker Desktop aberto, e acesse `http://127.0.0.1:5173/`. A demonstração usa apenas dados sintéticos. Para usar a Gold da pipeline, configure `backend/.env` e execute `pnpm dev`.

O painel permite selecionar um ano e sete filtros opcionais: curso, área geral CINE, modalidade, categoria administrativa, organização acadêmica, município de oferta e município da sede. **Todos** significa ausência de restrição naquele campo. Os códigos aparecem junto dos nomes e são enviados como texto, preservando zeros iniciais.

Os filtros combinam por **E**. Os sete filtros opcionais atualizam automaticamente o resumo e a [evolução temporal](FRONTEND_ANALISES.md). **Ano do resumo** afeta apenas os indicadores anuais; o gráfico possui seu próprio intervalo. **Limpar filtros** remove apenas os sete filtros opcionais e mantém ano e período. **Atualizar dados** recarrega catálogo, resumo e série, preservando as seleções que ainda existem e o intervalo aplicado. Se uma opção selecionada sair da base, ela é removida e a tela avisa; um ano removido é substituído pelo mais recente disponível.

O catálogo contém opções de toda a base, não apenas do ano ou recorte selecionado. Por isso, combinações sem registros são esperadas. A tela mostra ausência de dados, em vez de inventar totais iguais a zero. Em caso de falha de consulta, use **Atualizar dados** para tentar novamente.

Município de oferta e município da sede são conceitos diferentes. Uma sede informada para EaD não implica que exista município de oferta. Os filtros institucionais descrevem grupos e não identificam uma IES individual.

## Organização do código

```text
frontend/src/
  App.tsx                                  Estrutura geral e texto de apresentação
  modules/
    analises/                              Evolução temporal: consulta, período, gráfico e tabela
    catalogos/
      index.ts                             Entrada pública
      api.ts                               Contrato e consulta a /api/v1/filtros
    indicadores/
      index.ts                             Entrada pública do painel
      PainelIndicadores.tsx                 Carregamento, seleção e estados da tela
      FiltrosIndicadores.tsx                Campos e ações dos filtros
      ResumoIndicadores.tsx                Totais, taxas e avisos de qualidade
      filtros.ts                           Serialização, limpeza e atualização da seleção
      api.ts                               Contrato e consulta do resumo
  lib/http.ts                              Requisições HTTP e tratamento de falha
  main.tsx                                 Carrega Bootstrap antes do tema da aplicação
  styles.css                               Tema e estilos específicos do painel
```

O painel de indicadores compõe o catálogo e a evolução temporal pelas entradas públicas de `catalogos` e `analises`. O módulo de análises reutiliza apenas os tipos públicos de indicadores. Os contratos são tipos do cliente HTTP; não há importação de código interno do backend.

## Ciclo da consulta

1. O painel busca `GET /api/v1/filtros` e seleciona o primeiro ano do catálogo, ordenado do mais recente ao mais antigo.
2. A seleção é serializada com `URLSearchParams`. Campos opcionais vazios não entram na URL.
3. O painel consulta `GET /api/v1/indicadores/resumo` com ano e filtros ativos.
4. A API calcula o resultado; o frontend apenas formata números e proporções para exibição.

Cada resposta é associada à seleção e à tentativa que a originaram. Ao alterar filtros ou atualizar os dados, respostas anteriores deixam de ser exibidas. Requisições anteriores são canceladas com `AbortController`; callbacks verificam o cancelamento para não sobrescrever uma seleção mais recente. Durante a consulta aparecem estados de carregamento; erros não reaproveitam os totais anteriores.

Seleções usam controles nativos com rótulos e a classe `form-select` do Bootstrap. Os avisos de carregamento, erro e ausência de dados são anunciados por regiões acessíveis. A grade Bootstrap usa uma coluna abaixo de 576 px, duas de 576 a 991 px e três a partir de 992 px. Os detalhes do tema estão em [Estilização do frontend](FRONTEND_ESTILIZACAO.md).

## Verificação com dados sintéticos

| Seleção                          | Resultado esperado                                                 |
| -------------------------------- | ------------------------------------------------------------------ |
| 2022, sem filtros opcionais      | 1.000 vínculos; evasão do curso 10%; evasão da IES 9%              |
| 2023, curso `001`, área `01`     | 100 vínculos; evasão do curso 15%; evasão da IES 10%               |
| 2023, categoria Pública Federal  | 1.000 vínculos; evasão do curso 24%; evasão da IES 19%             |
| 2023, curso `001`, área `06`     | Sem dados para a combinação                                        |
| 2023, curso `002`, sede Cuiabá   | 900 vínculos                                                       |
| Seleção anterior e oferta Cuiabá | Sem dados; a sede não substitui a oferta ausente                   |
| 2023, curso `005`                | Preserva decimais e exibe avisos de valor negativo e grupo pequeno |
| 2024                             | Sem dados de alunos; existem somente docentes                      |

Confira também: limpar mantém o ano; atualizar mantém filtros válidos; trocar rapidamente os filtros apresenta apenas o último recorte; parar a API exibe um erro recuperável; a tela funciona em largura de celular.

`pnpm test` inclui testes de serialização de todos os filtros, zeros iniciais, caracteres acentuados, limpeza e atualização do catálogo. `pnpm check` também verifica tipos e build. Os testes de integração do backend exercitam os filtros contra PostgreSQL. A validação com a carga real permanece necessária.
