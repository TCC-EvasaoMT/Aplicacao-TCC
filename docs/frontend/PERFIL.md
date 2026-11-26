# Perfil de quem evade na interface

A seção **Perfil de quem evade** fica na aba **Resumo**, abaixo dos cartões, e consome `GET /api/v1/analises/perfil`. O resumo mostra quanto se evade no ano e no recorte; o perfil mostra em quais categorias de um fator a evasão é maior. Contrato, decisões e resultados esperados estão na [API de perfil](../api/PERFIL.md).

## Fator, taxa e filtros

**Fator** escolhe um dos 12 fatores de prioridade 1: sexo, cor/raça, faixa etária, deficiência, naturalidade, escola do ensino médio, cotas, Enem, vestibular, apoio social, atividade extracurricular e turno. **Taxa** alterna entre evasão do curso e evasão da instituição sem nova consulta. As duas escolhas ficam na URL (`fator_perfil` e `taxa_perfil`); sexo e evasão do curso são os padrões e não são gravados.

O ano e todos os filtros do painel se aplicam: sem filtros, o perfil é de MT; com área, modalidade ou tipo de instituição, é daquele recorte. Não há clique de filtragem na tabela, porque categoria de perfil não é filtro do painel.

## Textos e avisos

- **Ajuda fixa:** as taxas mostram associação, não causa, e o total do fator pode diferir do resumo, porque cada fator é uma consulta própria ao SEDAP+.
- **Associação:** uma frase cita a categoria de maior e a de menor taxa entre as que têm taxa e base de risco de pelo menos 30, por exemplo "Evasão do curso maior entre “Não” (26,94%) e menor entre “Sim” (0,44%), considerando 2 categorias…". Sem duas categorias comparáveis, a frase diz isso.
- **Ressalva dos fatores circulares:** apoio social e atividade extracurricular só existem para quem está vinculado, e quem sai cedo tem menos tempo para receber o apoio ou participar. Um aviso explica que a diferença pode refletir essa condição, e não um efeito do apoio ou da atividade.
- **Sem dados:** fator fora da base conectada e recorte sem registros têm mensagens próprias.

## Tabela e CSV

A tabela lista as categorias na ordem do catálogo, com a taxa escolhida, uma barra decorativa proporcional à maior taxa, a base de risco e os avisos de qualidade do resumo (base inferior a 30, dados incompletos, negativos, sem dados). Categorias sem registros e códigos fora do catálogo aparecem com "...", sem valores inventados. A última linha, **Todas as categorias**, é o conjunto do fator.

O CSV `evasao-mt-perfil-<fator>-<ano>.csv` traz fator, código e nome da categoria, vínculos, matrículas, concluintes, base, as duas taxas e as marcas de qualidade, sem as colunas de ingressantes, seguindo as regras de [estado e exportação](ESTADO_E_EXPORTACAO.md#csv). A última linha é o conjunto.

## Organização do código

| Arquivo (`src/modules/analises/`) | Responsabilidade                                                                    |
| --------------------------------- | ----------------------------------------------------------------------------------- |
| `api.ts`                          | Tipos `Perfil`, `CategoriaPerfil`, `ResumoPerfil` e `consultarPerfil`               |
| `perfil.ts`                       | Funções puras: fatores e ressalvas, consulta, fator e taxa da URL, extremos e barra |
| `PainelPerfil.tsx`                | Seletores, consulta cancelável, estados, textos, tabela e CSV                       |
| `apresentacao.ts`                 | `avisosDoRecorte` aceita a qualidade sem ingressantes                               |
| `exportacao.ts`                   | `csvPerfil`                                                                         |

`PainelIndicadores` monta a seção dentro do painel do resumo. Enquanto um novo recorte carrega, o último perfil fica na tela, esmaecido; uma falha mostra a mensagem e o botão de tentar de novo só na seção.

## Validação

`test/perfil.test.ts` cobre a consulta com todos os filtros, o fator e a taxa da URL, os 12 fatores e as ressalvas, os extremos só entre categorias comparáveis, a barra, os avisos sem ingressantes e o CSV.

Em 26/11/2026, com `pnpm dev:demo`, no navegador do aplicativo (Chromium):

- apoio social em 2023: Não 26,94%, Sim 0,44%, código 7 sem dados, conjunto 24,02%, ressalva visível e frase de associação;
- sexo pelo teclado: URL sem `fator_perfil` (padrão), Masculino sem taxa e a frase de que não há duas categorias para comparar;
- área 01 com evasão da instituição pela URL: Sim com base 10 sinalizada e fora da comparação;
- 320 px sem rolagem lateral da página.

Não foram verificados leitor de tela real, axe-core, Firefox, Safari nem dados reais.
