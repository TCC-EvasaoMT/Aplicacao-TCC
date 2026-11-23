# Fontes e definições dos indicadores

A API lê o PostgreSQL; não consulta SEDAP+, IBGE ou CINE Brasil diretamente. A pipeline separada obtém e integra essas fontes. O contrato descrito aqui se baseia na modelagem local `MODELAGEM_GOLD_EVASAO.md`, conferida por seus autores em 20/11/2026, e nas consultas da aplicação. As alterações posteriores da pipeline precisam ser comparadas com esse contrato antes da validação real.

## Fontes e cruzamentos

| Fonte                             | Conteúdo esperado na pipeline                                                           | Uso pela aplicação                                                                                   |
| --------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| SEDAP+ / INEP                     | Contagens agregadas de vínculos e docentes, além dos atributos de cursos e instituições | Medidas de alunos em `fato_evasao_curso` e atributos das dimensões                                   |
| IBGE                              | Referência de municípios, UF e divisões territoriais                                    | Nomes dos municípios de oferta e sede; os demais atributos territoriais não são filtros da API atual |
| CINE Brasil / INEP                | Rótulos dos cursos e áreas geral, específica e detalhada                                | Nomes de referência e agrupamento pela área geral CINE                                               |
| Catálogo do Censo Superior / INEP | Significado dos códigos de categoria, modalidade e outros atributos                     | Textos decodificados pela pipeline; o catálogo não acrescenta medidas                                |

Segundo a modelagem, o cruzamento ocorre na Silver. O município do curso e o município da sede ligam-se ao IBGE por seus códigos; o rótulo CINE liga-se à classificação por `CO_CINE_ROTULO`. As medidas vêm do SEDAP+; IBGE e CINE descrevem os grupos.

A carga deve preservar registros sem referência, usando membros de dimensão para valores não informados ou mantendo códigos sem nome, conforme a regra de cada dimensão. Isso precisa ser conferido na pipeline atual: não se deve afirmar que todo código sem correspondência tem exatamente o mesmo tratamento.

## Recorte e unidade de contagem

A modelagem prevê graduação em IES públicas com sede em Mato Grosso, de 2019 a 2023. Cursos ofertados em MT por instituições com sede em outro estado ficam fora desse recorte. O filtro de seleção pertence à pipeline. A API não aplica uma restrição automática a UF, nível de ensino ou categoria pública: ela consulta a Gold conectada.

A unidade é o vínculo aluno-curso. Uma pessoa em dois cursos pode contribuir com dois vínculos; totais de vínculos não são contagens de pessoas distintas. O SEDAP+ fornece agregados com ruído e pode omitir grupos. A aplicação preserva os valores disponíveis, sem tentar reconstruir pessoas ou grupos omitidos.

A API aceita novos anos carregados na fato sem restringir o catálogo a 2019 a 2023. A base de demonstração contém 2022, 2023 e 2024 e é inteiramente sintética; esses anos não comprovam cobertura real do estudo.

## Contrato da Gold consumida

As consultas usam `gold.fato_evasao_curso` e seis dimensões:

| Dimensão                | Conteúdo usado                                                      |
| ----------------------- | ------------------------------------------------------------------- |
| `dim_tempo`             | Ano do censo                                                        |
| `dim_curso`             | Código original e nome do curso                                     |
| `dim_area_conhecimento` | Código e nome da área geral CINE                                    |
| `dim_localidade`        | Código e nome do município de oferta                                |
| `dim_oferta`            | Modalidade                                                          |
| `dim_instituicao`       | Categoria administrativa, organização acadêmica e município da sede |

O grão esperado é curso por ano. Os IDs `id_*` servem às junções no banco e não são identificadores públicos estáveis. A API expõe códigos originais como texto, preservando zeros iniciais, e atributos como modalidade.

O [SQL compartilhado](../../backend/src/plugins/gold.ts) usa seis `JOIN`s diretos da fato às dimensões. Chaves e membros de dimensão precisam existir: uma referência órfã pode eliminar a linha da consulta. Os testes sintéticos não comprovam essa integridade na carga real.

Oferta e sede são dimensões distintas. Oferta ausente em EaD não recebe a sede como substituta. Características institucionais podem reunir várias IES; os resultados não permitem identificar instituições por nome ou sigla. Na modelagem de referência, os atributos de curso podem refletir o último ano observado, enquanto instituição, área, localidade e oferta seguem o ano da fato. Essa regra também deve ser conferida na integração.

A modelagem descreve ainda fatos de coorte, perfil e contexto docente. A API atual não as consulta. Não se devem somar fatos de grãos diferentes nem fatores de perfil distintos para reconstruir o total de alunos.

## Medidas e taxas

O [resumo anual](../../backend/README.md#cálculos-e-qualidade) retorna nove totais: vínculos, ingressantes, matrículas, concluintes, cursando, desvinculados, transferidos, trancados e falecidos. O SQL soma as medidas do recorte; funções TypeScript calculam as taxas:

| Indicador       | Fórmula sobre as somas do recorte              |
| --------------- | ---------------------------------------------- |
| Base de risco   | Vínculos menos falecidos                       |
| Evasão do curso | (Desvinculados + transferidos) / base de risco |
| Evasão da IES   | Desvinculados / base de risco                  |

Uma taxa `0.20` representa 20%. A agregação ocorre antes da divisão; não se faz média das taxas dos cursos. Transferência entra na evasão do curso e não na da IES. Trancamento e conclusão não entram nesses numeradores.

Os valores decimais e negativos são preservados. Ausência de dados não vira zero; medidas incompletas geram total `null`. Base ausente ou não positiva e numerador ausente geram taxa `null`. A qualidade informa registros sem alunos, dados incompletos, negativos na origem e base agregada inferior a 30. Linhas só com docentes não produzem contagens de alunos.

O frontend mostra quatro totais (vínculos, ingressantes, matrículas e concluintes) e duas taxas. Os outros totais estão na API, mas não têm cartões próprios. A variação anual usa os resultados de dois censos e não acompanha uma coorte. Nenhuma dessas visualizações demonstra uma causa da evasão.

Vagas e inscritos não existem no contrato atual. A fórmula do TCC I, desvinculados divididos por matrículas, também difere das duas taxas adotadas. A [matriz de requisitos](../tcc/RASTREABILIDADE.md) registra essas divergências.

## Origem, rastreabilidade e validação

O DDL sintético de [teste](../../backend/test/fixtures/gold-schema.sql) deriva da revisão `ff66b7d44306a257fedde422a771848cc9a7899f` da pipeline. É uma referência dos testes, não uma migração de produção nem uma confirmação do schema mais recente.

Antes de conectar dados reais, registrar a revisão da pipeline, o recorte da carga, a origem das referências e a identificação da execução. A aplicação ainda não expõe uma linhagem por resposta ou a data da última carga. A preservação dos dados brutos e os termos de acesso/publicação do SEDAP+ precisam ser confirmados pelo responsável pela pipeline; acesso institucional não comprova permissão de redistribuição em nuvem.

Use o [roteiro de validação](../operacao/VALIDACAO.md#validação-com-a-gold-real) para comparar SQL, API, interface e CSV. Credenciais, extrações reais e o texto acadêmico local permanecem fora do Git.
