# Evolução temporal na interface

O módulo `frontend/src/modules/analises` consulta a [API de evolução temporal](../api/ANALISES_TEMPORAIS.md). `PainelEvolucao` recebe os anos do catálogo, a seleção de filtros, um contador de atualização, a disponibilidade do catálogo e o callback para alterar o ano do resumo. As fórmulas de evasão permanecem no backend.

## Organização

| Arquivo               | Responsabilidade                                         |
| --------------------- | -------------------------------------------------------- |
| `index.ts`            | Exporta o painel pela entrada pública do módulo          |
| `api.ts`              | Tipos e consulta HTTP com cancelamento                   |
| `periodo.ts`          | Intervalo padrão, validação e serialização dos filtros   |
| `PainelEvolucao.tsx`  | Formulário, carregamento, falha e nova tentativa         |
| `GraficoEvolucao.tsx` | Gráfico Recharts e tabela acessível                      |
| `apresentacao.ts`     | Formatação de taxas e avisos dos recortes                |
| `exportacao.ts`       | Geração do CSV com recorte, medidas e qualidade          |
| `Celulas.tsx`         | Tabela, células de valor, ausência de dados e exportação |

Os tipos de seleção e resultado são compartilhados pela entrada pública de `indicadores`, sem importar implementações internas. O cliente HTTP é o mesmo dos outros módulos. Recharts é a biblioteca de gráficos prevista no documento do TCC. Os campos de período, o botão e as mensagens de erro usam componentes do PrimeReact; layout e tabela usam Tailwind com o [tema da aplicação](ESTILIZACAO.md). React controla eventos, validação e carregamento.

## Período e filtros

Execute `pnpm dev:demo` e abra `http://127.0.0.1:5173/`. O gráfico fica na aba **Evolução**, a segunda do cabeçalho; o resumo anual tem aba própria. Sob o título do resumo, uma linha informa quantos cursos com alunos entram no cálculo (`qualidade.registros_com_alunos`; cada registro é um curso no ano) e lembra que os valores são de um único ano do Censo, enquanto a aba Evolução mostra vários. Sem filtros, a faixa do recorte mostra "Todos os cursos". **Atualizar dados** recarrega catálogo, resumo, evolução e comparação; **Limpar filtros** mantém o ano do resumo e o intervalo do gráfico, removendo os sete filtros opcionais.

O intervalo inicial vem da URL, quando válido; caso contrário, vai do menor ao maior ano do catálogo, limitado aos últimos 30 anos. Os campos aceitam anos entre 1900 e 9999, inclusive anos sem registros. **Aplicar período** valida ordem e tamanho antes de consultar; editar os campos mantém a série aplicada. O período é preservado ao atualizar os dados e pode ser compartilhado pela URL.

Os sete filtros de recorte são combinados por E. O parâmetro `ano` do resumo não é enviado à consulta temporal e sua alteração não dispara nova consulta da série. Os códigos permanecem como texto, inclusive zeros iniciais. O município da sede não substitui o município de oferta.

A resposta é associada à consulta e à tentativa de atualização. Alterar recorte ou período cancela a requisição anterior com `AbortController`; respostas canceladas são descartadas. Durante a espera, a última série permanece esmaecida, com seu período original. Em caso de erro da API, ela deixa de ser exibida e **Tentar novamente** repete apenas a consulta temporal.

## Leitura do gráfico

- Duas linhas representam as taxas de evasão do curso e da IES; a segunda é tracejada para não depender somente das cores.
- A API retorna proporções; a interface formata percentuais. Não calcula médias, interpola lacunas nem limita as taxas ao intervalo de 0 a 100%.
- Valores `null` não viram zero. As linhas são interrompidas e pontos isolados permanecem visíveis.
- A tabela contém ano, base de risco, taxas e avisos de ausência, registros sem alunos, medidas incompletas, valores negativos e base inferior a 30.
- Base não positiva é identificada na tabela. Um período sem taxas exibe uma mensagem e mantém os valores e avisos disponíveis.
- O gráfico permite navegação pelo teclado via Recharts. A tabela usa cabeçalhos semânticos e rolagem horizontal em telas estreitas.

Resumo, legenda e tabela usam os mesmos nomes: **Evasão do curso** e **Evasão da instituição**. As colunas numéricas são alinhadas à direita e os avisos de cada ano aparecem em lista. Em um período inválido, o foco vai para o primeiro campo a corrigir; erros de ordem ou de tamanho do intervalo apontam para o ano final. O período já aplicado continua visível até uma nova seleção válida.

Esta é uma comparação de censos anuais, não acompanhamento de coortes nem explicação causal da evasão.

Os anos presentes no catálogo podem ser selecionados no gráfico ou pelos botões da tabela para alterar o ano do resumo e da comparação. O botão **Baixar CSV** exporta a série carregada, incluindo suas lacunas. Consulte [interatividade](INTERATIVIDADE.md) e [estado e exportação](ESTADO_E_EXPORTACAO.md) para as regras e os limites do carregamento.

## Verificação

`pnpm test` cobre limites do intervalo, catálogo vazio, serialização dos sete filtros, independência do ano do resumo, códigos, percentuais e avisos anuais. `pnpm check` também verifica tipos e build.

Com `pnpm dev:demo`, confira o período 2022 a 2024:

| Recorte                   | Resultado esperado                                 |
| ------------------------- | -------------------------------------------------- |
| Curso `001`               | Curso 10% → 15%; IES 9% → 10%; lacuna em 2024      |
| Categoria Pública Federal | Em 2023, curso 24% e IES 19%                       |
| Curso `005`               | Em 2023, IES negativa e base 20,5, com avisos      |
| Curso `004`               | Base zero em 2023, sem taxas                       |
| Curso `003`               | Somente docentes, sem inventar contagens de alunos |
| Curso `001` e área `06`   | Período sem dados para a combinação                |
| 2000 a 2030               | Validação local; não enviar a consulta inválida    |

Teste também um único ano, lacunas entre anos, mudança rápida de filtros, falha e recuperação da API e largura de celular. A conferência com dados reais do INEP e a medição de desempenho em volume real continuam pendentes.

O aceite inicial do gráfico e do refinamento registrou 31 testes (21 backend e 10 frontend). A conferência no navegador incluiu curso `001`, ano único, ruído negativo, base zero, somente docentes, intervalo superior a 30 anos, largura de 390 px e recuperação após reconstruir a Gold sintética e reaplicar grants. O [registro de validação](../operacao/VALIDACAO.md) apresenta a evidência mais recente. Os critérios visuais estão em [estilização](ESTILIZACAO.md).

O build revisado em 24/11/2026, após a migração para PrimeReact e Tailwind, não emitiu aviso de chunk acima de 500 kB. O carregamento dos gráficos está descrito em [estado e exportação](ESTADO_E_EXPORTACAO.md); seu desempenho em conexão real ainda precisa ser medido.
