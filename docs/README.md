# Documentação da aplicação

A aplicação consulta a Gold da pipeline e apresenta indicadores de evasão num painel público. Esta documentação descreve o código integrado à `main`; funcionalidades de branches adiadas são identificadas nos respectivos documentos.

Para instalar e executar, comece pelo [README da raiz](../README.md). Para entender as diferenças entre o sistema e o projeto acadêmico, consulte a [matriz de requisitos do TCC](tcc/RASTREABILIDADE.md).

## Por assunto

| Pasta          | Conteúdo                                                              |
| -------------- | --------------------------------------------------------------------- |
| `arquitetura/` | Monólito modular, responsabilidades, dependências e decisão de acesso |
| `api/`         | Contratos das análises, parâmetros, respostas e exemplos              |
| `frontend/`    | Filtros, gráficos, interação, exportação e estilos                    |
| `metodologia/` | Fontes, recorte, definições e contrato esperado da Gold               |
| `operacao/`    | Proteção HTTP, logs, testes e validação com dados reais               |
| `tcc/`         | Rastreabilidade de RF01 a RF15 e RNF01 a RNF15                        |
| `imagens/`     | Capturas usadas na documentação                                       |

## Guias

- [Arquitetura da aplicação](arquitetura/ARQUITETURA.md) e [módulos do backend](arquitetura/MODULOS_BACKEND.md).
- [Fontes e indicadores](metodologia/FONTES_E_INDICADORES.md).
- [Preparação do backend, catálogo, resumo e fórmulas](../backend/README.md).
- [API de evolução temporal](api/ANALISES_TEMPORAIS.md) e [API de comparações](api/COMPARACOES.md).
- [Filtros do painel](frontend/FILTROS.md), [evolução temporal](frontend/ANALISES.md) e [comparações](frontend/COMPARACOES.md).
- [Interatividade](frontend/INTERATIVIDADE.md), [estado e exportação](frontend/ESTADO_E_EXPORTACAO.md) e [estilização](frontend/ESTILIZACAO.md).
- [Proteção da API e logs](operacao/SEGURANCA_API.md), [acesso administrativo adiado](arquitetura/AUTORIZACAO.md) e [validação](operacao/VALIDACAO.md).
- [Requisitos do TCC e lacunas](tcc/RASTREABILIDADE.md).
- [Branches, commits e revisão](../CONTRIBUTING.md).

## Escopo e manutenção

A pipeline tem repositório próprio. As regras documentadas para suas fontes descrevem o contrato esperado pela aplicação; a revisão da documentação não comprova que uma carga real o atende. O [roteiro de validação](operacao/VALIDACAO.md#validação-com-a-gold-real) orienta essa conferência.

O Word do TCC, a modelagem de referência e o mapa de desenvolvimento ficam na pasta local `docs-codex/`, ignorada pelo Git. A matriz versionada registra os requisitos e as diferenças sem depender de esses arquivos existirem em todo clone. Ela não substitui a revisão do Word pelo grupo e pelo orientador.

A captura `imagens/frontend-comparacoes.jpg` registra a entrega inicial das comparações. Ela é histórica e não representa todas as mudanças de interatividade posteriores.

Ao alterar uma funcionalidade, atualize seu guia, os critérios de validação e a linha correspondente da matriz. Registre resultados de testes com data e contexto; um roteiro pendente não deve ser descrito como teste executado.
