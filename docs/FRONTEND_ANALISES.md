# Evolução temporal na interface

O módulo `frontend/src/modules/analises` consulta a [API de evolução temporal](ANALISES_TEMPORAIS.md). O componente público `PainelEvolucao` recebe os anos do catálogo, a seleção de filtros, um contador de atualização e a disponibilidade do catálogo. As fórmulas permanecem no backend.

## Organização

| Arquivo               | Responsabilidade                                       |
| --------------------- | ------------------------------------------------------ |
| `index.ts`            | Exporta o painel pela entrada pública do módulo        |
| `api.ts`              | Tipos e consulta HTTP com cancelamento                 |
| `periodo.ts`          | Intervalo padrão, validação e serialização dos filtros |
| `PainelEvolucao.tsx`  | Formulário, carregamento, falha e nova tentativa       |
| `GraficoEvolucao.tsx` | Gráfico Recharts e tabela acessível                    |
| `apresentacao.ts`     | Formatação de taxas e avisos anuais                    |

Os tipos de seleção e resultado são compartilhados pela entrada pública de `indicadores`, sem importar implementações internas. O cliente HTTP é o mesmo dos outros módulos. Recharts é a biblioteca de gráficos prevista no documento do TCC. Os controles de período, mensagens de erro e tabela utilizam [Bootstrap com o tema da aplicação](FRONTEND_ESTILIZACAO.md). React controla eventos, validação e carregamento.

## Período e filtros

Execute `pnpm dev:demo` e abra `http://127.0.0.1:5173/`. O gráfico aparece abaixo do resumo anual, no mesmo painel. **Atualizar dados** recarrega catálogo, resumo e evolução; **Limpar filtros** mantém o ano do resumo e o intervalo do gráfico, removendo os sete filtros opcionais.

O intervalo inicial vai do menor ao maior ano do catálogo, limitado aos últimos 30 anos. Os campos aceitam anos entre 1900 e 9999, inclusive anos sem registros. **Aplicar período** valida ordem e tamanho antes de consultar; editar os campos não altera a série já aplicada. Um intervalo escolhido é preservado ao atualizar os dados.

Os sete filtros de recorte são combinados por E. O parâmetro `ano` do resumo não é enviado à consulta temporal e sua alteração não dispara nova consulta da série. Os códigos permanecem como texto, inclusive zeros iniciais. O município da sede não substitui o município de oferta.

A resposta é associada à URL e à tentativa de atualização. Alterar o recorte ou o período cancela a consulta anterior com `AbortController`. Respostas canceladas não podem sobrescrever a seleção atual. Em caso de erro, a série anterior deixa de ser exibida e **Tentar novamente** repete apenas a consulta temporal.

## Leitura do gráfico

- Duas linhas representam as taxas de evasão do curso e da IES; a segunda é tracejada para não depender somente das cores.
- A API retorna proporções; a interface apenas formata percentuais. Não calcula médias, interpola lacunas nem limita as taxas a 0–100%.
- Valores `null` não viram zero. As linhas são interrompidas e pontos isolados permanecem visíveis.
- A tabela contém ano, base de risco, taxas e avisos de ausência, registros sem alunos, medidas incompletas, valores negativos e base inferior a 30.
- Base não positiva é identificada na tabela. Um período sem taxas exibe uma mensagem e mantém os valores e avisos disponíveis.
- O gráfico permite navegação pelo teclado via Recharts. A tabela usa cabeçalhos semânticos e rolagem horizontal em telas estreitas.

Esta é uma comparação de censos anuais, não acompanhamento de coortes nem explicação causal da evasão.

## Verificação

`pnpm test` cobre limites do intervalo, catálogo vazio, serialização dos sete filtros, independência do ano do resumo, códigos, percentuais e avisos anuais. `pnpm check` também verifica tipos e build.

Com `pnpm dev:demo`, confira o período 2022–2024:

| Recorte                   | Resultado esperado                                 |
| ------------------------- | -------------------------------------------------- |
| Curso `001`               | Curso 10% → 15%; IES 9% → 10%; lacuna em 2024      |
| Categoria Pública Federal | Em 2023, curso 24% e IES 19%                       |
| Curso `005`               | Em 2023, IES negativa e base 20,5, com avisos      |
| Curso `004`               | Base zero em 2023, sem taxas                       |
| Curso `003`               | Somente docentes, sem inventar contagens de alunos |
| Curso `001` e área `06`   | Período sem dados para a combinação                |
| 2000–2030                 | Validação local; não enviar a consulta inválida    |

Teste também um único ano, lacunas entre anos, mudança rápida de filtros, falha e recuperação da API e largura de celular. A conferência com dados reais do INEP e a medição de desempenho em volume real continuam pendentes.

Na verificação desta entrega em Windows, `pnpm check` passou com 30 testes (21 do backend e 9 do frontend). No navegador, foram conferidos curso `001`, ano único, ruído negativo, base zero, somente docentes, rejeição de intervalo superior a 30 anos, apresentação em 390 px e recuperação após parar e reconstruir a Gold de demonstração com os grants reaplicados.

O build emite um aviso de bundle JavaScript acima de 500 kB após incluir Recharts; a medição de carregamento em conexão real e eventual divisão do bundle permanecem pendentes. A verificação global de Prettier aponta uma pendência anterior em `scripts/demo.mjs`; os arquivos desta entrega passam na verificação de formatação.
