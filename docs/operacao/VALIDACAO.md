# Validação da aplicação

Os testes sintéticos verificam contratos, cálculos e integração com PostgreSQL. A validação acadêmica também precisa comparar os resultados com uma carga real da pipeline e medir o desempenho no ambiente escolhido. Essas são verificações distintas.

## Comandos e ambientes

Execute na raiz do repositório:

```powershell
pnpm check
pnpm format:check
```

`check` executa tipos, testes unitários/HTTP e build. Não executa a suíte de integração PostgreSQL nem testes de navegador.

Para a integração automatizada, use o PostgreSQL descartável da porta 55432:

```powershell
docker compose -f backend/test/compose.yml up -d --wait
$env:TEST_DATABASE_URL = 'postgresql://postgres:tcc_test@127.0.0.1:55432/postgres'
pnpm test:integration
```

A suíte cria bancos e roles temporários. Sem `TEST_DATABASE_URL`, ela informa que foi pulada; isso não conta como validação da integração. Encerre esse ambiente quando não estiver em uso:

```powershell
docker compose -f backend/test/compose.yml down
```

Para testes manuais, `pnpm dev:demo` prepara outro PostgreSQL, na porta 55433, e inicia a aplicação. `pnpm db:demo` prepara apenas o banco. Cada preparação recria a Gold sintética; nunca use esse container para armazenar dados reais. O [README](../../README.md#testes-com-postgresql) explica os comandos e as portas.

## Evidências disponíveis

| Verificação                                        | Evidência registrada                                                                                                                                    | Limite                                                                                                                               |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| API de comparações, 22/11/2026                     | 41 testes no `pnpm check`; 18 cenários PostgreSQL, 19 testes contando o agrupador                                                                       | Dados sintéticos; o tempo da fixture não comprova desempenho real                                                                    |
| Frontend de comparações, 22/11/2026                | 47 testes; navegador em 1280, 390 e 320 px, seleção máxima, truncamento e recuperação da Gold                                                           | Integração automatizada não repetida naquele incremento                                                                              |
| Revisão da `main` `72e9654`, 23/11/2026            | 66 testes, sendo 31 backend e 35 frontend; tipos, build e `format:check` aprovados                                                                      | Não inclui uma nova execução da suíte PostgreSQL automatizada                                                                        |
| Navegador na mesma revisão                         | Frontend compilado com API e PostgreSQL sintético; filtros cruzados, restauração da URL e CSV conferidos                                                | Dados reais, outros navegadores e outras plataformas não foram revalidados                                                           |
| Tamanho dos arquivos JavaScript no build revisado  | Dois maiores arquivos com aproximadamente 493 e 447 kB, sem aviso de chunk acima de 500 kB                                                              | Tamanho de arquivo não mede o tempo de uso numa conexão real                                                                         |
| Migração para PrimeReact e Tailwind, 24/11/2026    | 66 testes (31 backend e 35 frontend), 19 de integração com PostgreSQL embutido, tipos e build; navegador em 1280, 390 e 320 px; axe-core sem violações  | `format:check` acusa só `backend/README.md`, já fora do padrão na `main`; sem leitor de tela real, outros navegadores ou dados reais |
| Build da migração, 24/11/2026                      | Maiores arquivos JavaScript com cerca de 449, 256 e 219 kB; CSS com 31 kB; servido pelo Fastify com a CSP                                               | Tamanho de arquivo não mede o tempo de uso numa conexão real                                                                         |
| Refinamento visual e gaveta de filtros, 24/11/2026 | Tipos, testes e build; navegador em 1280, 390 e 320 px; foco, Esc e retorno ao botão da gaveta; axe-core sem violações com a gaveta e uma lista abertas | Sem leitor de tela real, outros navegadores ou dados reais                                                                           |

Os guias de interface preservam registros dos aceites anteriores. A indicação de axe-core sem violações nesses registros não equivale a auditoria completa de acessibilidade ou teste com leitor de tela. O workflow em Linux está configurado; consultar o resultado da execução no GitHub antes de afirmar que uma revisão passou na CI.

## Validação com a Gold real

### Preparar a referência

1. Registrar a revisão da aplicação, a revisão da pipeline, a identificação da carga e os anos disponíveis.
2. Obter o DDL atual com o responsável pela pipeline. Conferir nomes, tipos, grão, chaves e membros de dimensão contra as [consultas da aplicação](../../backend/src/plugins/gold.ts) e as [definições dos indicadores](../metodologia/FONTES_E_INDICADORES.md).
3. Confirmar o recorte de graduação, IES públicas e sede em MT na carga. A API não aplica esse recorte por conta própria.
4. Preparar o login exclusivo de leitura e os grants, conforme o [README do backend](../../backend/README.md#preparar-o-acesso-ao-postgresql). Preservar o `.env` existente e combinar a conexão correta com o responsável.
5. Consultar `/health` e `/api/v1/filtros`. Saúde `200` comprova acesso às tabelas, não qualidade, completude ou atualização dos dados.

### Reconciliar resultados

Escolher recortes identificáveis na carga e registrar a consulta de referência, os parâmetros HTTP e os resultados esperados. Comparar somas antes de dividir, respeitando medidas ausentes. Uma consulta de referência precisa ser revisada independentemente do código da API para evitar reproduzir o mesmo erro nos dois lados.

| Caso                                                | Conferência                                                                        |
| --------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Ano completo e cursos de tamanhos diferentes        | Taxas calculadas pela divisão das somas, sem média das taxas                       |
| Combinação de curso, área e modalidade              | Mesmo recorte no SQL, resumo e série                                               |
| Município de oferta e sede, incluindo EaD           | Oferta ausente não preenchida com sede                                             |
| Códigos com zeros e referências sem nome            | Código preservado; nenhum identificador artificial                                 |
| Ausência, docentes sem alunos e medidas incompletas | Distinguir `null`, zero, grupo ausente e linha sem alunos                          |
| Valores negativos, decimais e base pequena          | Preservar ruído e sinalizar qualidade pela base agregada                           |
| Comparação por cada dimensão                        | Resultado de um grupo equivalente ao resumo com seu filtro                         |
| Seleção e truncamento                               | Contagem de grupos anterior ao limite; CSV apenas dos grupos carregados            |
| Série anual e cartões de variação                   | Mesmo resultado anual do resumo; pontos percentuais distintos de variação relativa |

Conferir as respostas da API contra o SQL e depois comparar interface e CSV com a resposta recebida. Registrar as diferenças de arredondamento da apresentação. Ao comparar a requisição de grupos, considerar que o frontend omite o filtro da própria dimensão agrupada, como descrito em [interatividade](../frontend/INTERATIVIDADE.md).

### Medir desempenho e recuperação

Medir tempo HTTP completo de catálogo, resumo, série e comparação, com recortes amplos e restritos, primeiro acesso e repetições. Registrar volume de linhas, máquina, versão do PostgreSQL, quantidade de chamadas, concorrência e mínimo, mediana, percentil 95 e máximo. O RNF04 exige até três segundos fora da janela de ETL; uma mediana baixa ou uma resposta `503` rápida não comprova seu atendimento. Registrar separadamente consultas bloqueadas por `429`.

Em ambiente de integração acordado, acompanhar uma reconstrução da Gold feita pelo responsável pela pipeline, reaplicar grants e verificar a recuperação da API sem reiniciá-la. Não usar a base real para reproduzir testes destrutivos da fixture. Registrar o período de indisponibilidade e conciliar essa janela com RNF04 e RNF11.

O processamento em até 60 minutos, a imutabilidade dos brutos e o custo mensal de até US$ 65 dependem de evidências da pipeline e da infraestrutura. Não podem ser concluídos a partir do tempo de resposta da API.

### Registrar o aceite

O registro deve informar versões, ambiente, recortes, consultas, resultados esperados e obtidos, tempos, divergências, responsável e data. Guardar credenciais e dados reais fora do Git; versionar apenas evidências agregadas cuja publicação esteja autorizada. Atualizar o estado de cada requisito na [matriz do TCC](../tcc/RASTREABILIDADE.md) somente depois da conferência.

## Ajustes adiados

Na revisão de 23/11/2026, dois comportamentos foram reproduzidos sob condições simuladas e deixados para depois pelo responsável:

1. Com a consulta atrasada na base sintética, a faixa do recorte exibiu o filtro novo com as taxas da resposta anterior, sem indicar a espera. Após a resposta, os valores se alinham ao filtro. A correção deve ocultar ou identificar os valores antigos enquanto a atualização estiver pendente.
2. Ao simular falha no carregamento do JavaScript do gráfico, tabela e CSV da mesma seção desapareceram porque compartilham o componente lazy. A correção deve permitir que esses recursos permaneçam disponíveis independentemente do gráfico.

Esses testes não demonstraram quebra dos fluxos normais exercitados. A autenticação também permanece adiada em branches separadas; esta documentação não a habilita.
