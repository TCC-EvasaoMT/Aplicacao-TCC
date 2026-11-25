# Comparações na interface

A seção **Comparação entre grupos**, na aba **Comparação** do cabeçalho, consome `GET /api/v1/analises/comparacoes`. Permite comparar cursos, áreas gerais CINE, municípios de oferta ou sede, modalidades, categorias administrativas e organizações acadêmicas. A consulta permanece pública, sem login. O [contrato da API](../api/COMPARACOES.md) não mudou.

## Como utilizar

1. Execute `pnpm dev:demo` com Docker Desktop aberto e acesse `http://127.0.0.1:5173/`.
2. O painel abre em **2023**, o ano mais recente com dados de alunos; 2024 contém apenas docentes. **Ano da comparação** permite trocar o ano.
3. Escolha **Agrupar por**. O padrão é categoria administrativa.
4. Opcionalmente, abra **Selecionar grupos**, busque por nome ou código e marque até 20 opções.
5. Clique em **Comparar grupos**. A tabela apresenta os totais, a base de risco, as duas taxas e a qualidade de cada grupo.

Sem seleção explícita, a API retorna até 20 grupos na ordem de código ou atributo. Isso não é um ranking de evasão. Quando há mais resultados, a tela informa quantos foram exibidos e orienta selecionar os grupos desejados ou refinar os filtros. Os grupos sem identificador podem aparecer nessa consulta, com o rótulo **Não informado (sem identificador)**; não são opções selecionáveis do catálogo e não devem receber códigos inventados.

Ao marcar 20 opções, as demais ficam desabilitadas até que alguma seja desmarcada. A busca aceita código ou parte do nome, sem distinguir acentos ou maiúsculas. Buscar não altera as seleções. **Limpar seleção de grupos** prepara a consulta sem seleção explícita; é necessário clicar em **Comparar grupos** para aplicar.

## Ano, filtros e seleção

**Ano do resumo** e **Ano da comparação** controlam o mesmo estado. Alterar qualquer um atualiza imediatamente resumo e comparação, preservando o período independente da evolução temporal.

Os sete filtros globais são combinados por E e se aplicam às três consultas, com uma exceção: a comparação não envia o filtro da dimensão pela qual agrupa. Com `codigo_curso=001` e agrupamento por curso, todos os cursos seguem visíveis e o 001 fica em destaque; resumo e evolução recebem o filtro normalmente. Veja [Interatividade e filtragem cruzada](INTERATIVIDADE.md). Grupos selecionados dentro da comparação combinam-se por OU, respeitando os demais filtros.

Agrupamento e seleção de grupos têm um rascunho e uma configuração aplicada. Editar esses campos não dispara a consulta; a tela avisa quando existem mudanças pendentes e identifica o agrupamento aplicado junto ao resultado. Trocar de dimensão limpa a seleção do rascunho. Alterar o ano ou os filtros globais atualiza a configuração já aplicada.

As opções vêm do catálogo de toda a base e podem não ter registros naquele ano. A API omite grupos sem correspondência; a interface lista os identificadores ausentes e não cria linhas com zero. Um grupo com registros somente de docentes continua aparecendo, com medidas indisponíveis e avisos próprios.

**Atualizar dados**, no resumo, recarrega catálogo e as três consultas, preservando a configuração comparativa. Uma seleção de grupo que deixou o catálogo permanece disponível para desmarcar, identificada como **fora do catálogo atual**. Ela não é descartada silenciosamente, pois esvaziar a seleção ampliaria a consulta para todos os grupos. **Limpar filtros** remove somente os sete filtros globais; mantém ano, período e configuração comparativa.

## Organização e consulta

Os arquivos ficam em `frontend/src/modules/analises`:

| Arquivo                  | Responsabilidade                                                   |
| ------------------------ | ------------------------------------------------------------------ |
| `index.ts`               | Entrada pública de `PainelEvolucao` e `PainelComparacoes`          |
| `api.ts`                 | Tipos das respostas e consultas HTTP canceláveis                   |
| `comparacoes.ts`         | Dimensões, opções, rótulos, limite, serialização e grupos ausentes |
| `PainelComparacoes.tsx`  | Formulário, configuração aplicada, requisição e estados            |
| `SeletorGrupos.tsx`      | Painel recolhível com busca e caixas de marcação do PrimeReact     |
| `GraficoComparacoes.tsx` | Barras horizontais e tabela acessível                              |
| `apresentacao.ts`        | Percentuais e avisos compartilhados com a evolução temporal        |

`PainelIndicadores` compõe a entrada pública de análises, fornecendo catálogo, seleção global, contador de atualização e alteração do ano. Análises importa apenas os tipos públicos de `catalogos` e `indicadores`, sem acessar suas implementações internas. A comunicação usa o cliente HTTP existente; não há novas dependências, migrações, configuração ou integração adicional com a pipeline.

A URL é montada com `URLSearchParams`, preservando zeros iniciais e repetindo `grupos` para cada seleção. Cada resposta é vinculada à consulta e à tentativa. `AbortController` cancela requisições substituídas, e os callbacks descartam respostas canceladas. Enquanto a nova consulta carrega, a comparação anterior permanece esmaecida, com seu ano e agrupamento. Catálogo indisponível bloqueia a consulta. Falhas da API removem os resultados e oferecem **Tentar comparação novamente**, que repete somente essa requisição.

## Leitura e acessibilidade

- As barras seguem a ordem da API. A primeira barra de cada grupo mostra evasão do curso; a segunda, da instituição, com as mesmas cores das outras análises.
- O eixo inclui zero e preserva taxas negativas ou superiores a 100%. A interface formata proporções, sem calcular médias nem refazer fórmulas.
- `null` aparece como `...` na tabela (convenção do IBGE; o leitor de tela ouve "Não disponível") e sem barra no gráfico. Um zero real permanece zero.
- A tabela contém os quatro totais do resumo: vínculos, ingressantes, matrículas e concluintes, além de base, taxas e qualidade. Os demais totais continuam disponíveis na API.
- Avisos distinguem ausência de alunos, registros sem contagens, dados incompletos, valores negativos, base inferior a 30 e base não positiva.
- Códigos permanecem visíveis mesmo sem nome. Rótulos longos são abreviados apenas no eixo; o tooltip e a tabela preservam o texto completo.
- Listas, campos e caixas de marcação possuem rótulos associados; estados são anunciados, e a tabela tem cabeçalhos de linha e coluna. A tabela permite foco e rolagem horizontal em telas estreitas. Abaixo de 576 px, o nome do grupo fica acima das barras e o gráfico cabe na tela. Cada barra mostra o valor no fim. As barras não têm animação.

Características institucionais podem agrupar várias IES; não há comparação nominal entre instituições. Município da sede não substitui oferta ausente em EaD. Essas análises não demonstram causa da evasão.

Um clique no grupo aplica ou remove seu filtro global; os botões da tabela oferecem a mesma ação pelo teclado. **Baixar CSV** exporta apenas os grupos carregados, não todos os grupos de uma resposta truncada. A configuração aplicada fica na URL. Veja [interatividade](INTERATIVIDADE.md) e [estado e exportação](ESTADO_E_EXPORTACAO.md).

## Verificação

`frontend/test/comparacoes.test.ts` cobre os sete filtros, parâmetros repetidos, textos acentuados, zeros iniciais, seleção vazia, dimensões do catálogo, limite de 20, ausência de grupos e identificadores nulos. Os testes de apresentação compartilhada cobrem taxas negativas, acima de 100%, base zero, docentes e qualidade.

Na base de demonstração, use 2023:

| Recorte                                   | Resultado esperado                                                                  |
| ----------------------------------------- | ----------------------------------------------------------------------------------- |
| Curso, grupos `001` e `002`               | Bases 100 e 900; curso 15% e 25%; instituição 10% e 20%                             |
| Categoria administrativa, Pública Federal | Base 1.000; curso 24%; instituição 19%                                              |
| Curso `005`                               | Base 20,5; instituição −12,2%; avisos de negativo e base pequena                    |
| Curso `004`                               | Base zero, sem taxas                                                                |
| Curso `003`                               | Sem contagens de alunos, sem inventar zeros                                         |
| Município de oferta, sem seleção          | Grupo sem identificador mantém os 900 vínculos EaD e o registro somente de docentes |
| Ano 2022, grupos `001` e `002`            | Somente `001`; aviso de ausência de `002`                                           |
| Ano 2022, filtro global curso `002`       | Só `001` aparece; aviso de que o curso em destaque não tem registros no ano         |

Na conferência local em 22/11/2026, `pnpm check` passou com 47 testes (31 backend e 16 frontend), tipos e build. O navegador foi verificado em 1280, 390 e 320 px, incluindo foco por teclado, busca sem acento, seleção máxima, docentes, base zero, ruído, ausência de grupos, filtros combinados e recuperação após reconstrução da Gold e reaplicação de permissões. Grupos sintéticos temporários permitiram conferir o aviso **20 de 33** e o bloqueio da 21ª seleção; a base original foi restaurada após a verificação.

A suíte automatizada de integração do backend não foi repetida naquele incremento de interface. A conferência visual usou a API com PostgreSQL sintético. A evidência mais recente e as verificações pendentes estão no [guia de validação](../operacao/VALIDACAO.md). O carregamento dos gráficos está descrito em [estado e exportação](ESTADO_E_EXPORTACAO.md).
