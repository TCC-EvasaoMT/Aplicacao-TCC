import {
	CartesianGrid,
	ReferenceLine,
	ResponsiveContainer,
	Scatter,
	ScatterChart,
	Tooltip,
	XAxis,
	YAxis,
	type ScatterShapeProps
} from 'recharts'
import { useMemo, useState } from 'react'
import { useMedia } from '../../lib/useMedia'
import { Ajuda, classes, cx } from '../../lib/ui'
import type { Dispersao, TaxaDispersao } from './api'
import { avisosDoRecorte, escalaTaxas, formatarTaxa } from './apresentacao'
import {
	CelulaNumero,
	CelulaTaxa,
	classesLinha,
	classesLinkFiltro,
	classesTabela,
	ListaAvisos,
	NotaTabela,
	Tabela
} from './Celulas'
import {
	pontosDispersao,
	rotuloCurso,
	taxasDispersao,
	tetoMatriculas,
	type PontoDispersao,
	type SerieDispersao
} from './dispersao'
import { csvDispersao, descreverRecorte } from './exportacao'

const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })

const series: Record<
	SerieDispersao,
	{ rotulo: string; descricao: string; cor: string }
> = {
	critica: {
		rotulo: 'Zona crítica',
		descricao: 'Acima da linha e com base de risco suficiente',
		cor: 'var(--color-panel-secondary)'
	},
	significativa: {
		rotulo: 'Base suficiente',
		descricao: 'Abaixo ou na linha',
		cor: 'var(--color-panel-green)'
	},
	pequena: {
		rotulo: 'Base pequena',
		descricao: 'Nunca entra na zona crítica',
		cor: 'var(--color-panel-muted)'
	}
}

// Losango para a zona crítica, círculo cheio e círculo vazado: a série é
// reconhecível sem a cor.
function Marcador({
	serie,
	x,
	y,
	raio,
	destaque = false
}: {
	serie: SerieDispersao
	x: number
	y: number
	raio: number
	destaque?: boolean
}) {
	const { cor } = series[serie]
	const contorno = destaque
		? { stroke: 'var(--color-panel-ink)', strokeWidth: 2.5 }
		: {}
	if (serie === 'critica') {
		const r = raio * 1.25
		return (
			<polygon
				points={`${x},${y - r} ${x + r},${y} ${x},${y + r} ${x - r},${y}`}
				fill={cor}
				{...contorno}
			/>
		)
	}
	return (
		<circle
			cx={x}
			cy={y}
			r={raio}
			fill={serie === 'pequena' ? 'var(--color-panel-surface)' : cor}
			stroke={destaque ? 'var(--color-panel-ink)' : cor}
			strokeWidth={destaque ? 2.5 : serie === 'pequena' ? 1.5 : 0}
			fillOpacity={serie === 'significativa' ? 0.85 : 1}
		/>
	)
}

type PontoMarcado = PontoDispersao & { marcado: boolean }

// Componente estável: se fosse criado a cada renderização, o hover remontaria
// o ponto entre mousedown e mouseup, e o clique se perderia.
function FormaPonto(props: ScatterShapeProps) {
	const ponto = props.payload as PontoMarcado | undefined
	if (!ponto) return <g />
	const x = props.cx ?? 0
	const y = props.cy ?? 0
	return (
		<g style={{ cursor: ponto.codigo ? 'pointer' : 'default' }}>
			{/* Área de toque de 24 px, maior que o marcador. */}
			<circle cx={x} cy={y} r={12} fill="transparent" />
			<Marcador
				serie={ponto.serie}
				x={x}
				y={y}
				raio={ponto.marcado ? 7 : 5}
				destaque={ponto.marcado}
			/>
		</g>
	)
}

interface Props {
	dados: Dispersao
	taxa: TaxaDispersao
	// Parâmetros da consulta, usados para descrever o recorte no CSV.
	parametros: Record<string, string>
	// Código do curso usado como filtro ('' quando nenhum).
	destaque: string
	onSelecionar: (codigo: string) => void
}

export function GraficoDispersao({
	dados,
	taxa,
	parametros,
	destaque,
	onSelecionar
}: Props) {
	// Curso sob o ponteiro ou com foco na tabela; destaca o ponto. O hover no
	// gráfico não muda estado: qualquer re-renderização durante o hover faz o
	// Recharts recriar o ponto sob o cursor entre mousedown e mouseup, e o
	// clique se perde. A dica do gráfico já identifica o curso.
	const [ativo, setAtivo] = useState<string | null>(null)
	const estreito = useMedia('(max-width: 575px)')
	const rotuloTaxa =
		taxasDispersao.find((opcao) => opcao.valor === taxa)?.rotulo ?? ''
	const dadosSeries = useMemo(() => {
		const pontos = pontosDispersao(dados, taxa)
		const marcar = (serie: SerieDispersao): PontoMarcado[] =>
			pontos[serie].map((ponto) => ({
				...ponto,
				marcado:
					!!ponto.codigo &&
					(ponto.codigo === destaque || ponto.codigo === ativo)
			}))
		return {
			pequena: marcar('pequena'),
			significativa: marcar('significativa'),
			critica: marcar('critica')
		}
	}, [dados, taxa, destaque, ativo])
	const todos = [
		...dadosSeries.pequena,
		...dadosSeries.significativa,
		...dadosSeries.critica
	]
	const referencia = dados.referencias.alta_evasao[taxa]
	// Folga de 5% nos extremos, para os pontos não ficarem sobre a borda.
	const taxas = todos.map((p) => p.taxa)
	const escala = escalaTaxas([
		...taxas,
		referencia,
		Math.max(0, ...taxas) * 1.05,
		Math.min(0, ...taxas) * 1.05
	])
	function selecionar(ponto: unknown) {
		const codigo = (ponto as { payload?: PontoDispersao })?.payload?.codigo
		if (codigo) onSelecionar(codigo)
	}
	return (
		<>
			{todos.length ? (
				<figure
					className={classes.quadroGrafico}
					aria-label={`${rotuloTaxa} e matrículas por curso`}
					aria-describedby="dispersao-leitura"
				>
					<ResponsiveContainer width="100%" height={estreito ? 340 : 420}>
						<ScatterChart
							accessibilityLayer
							margin={{
								top: 16,
								right: estreito ? 12 : 24,
								bottom: 24,
								left: 0
							}}
						>
							<CartesianGrid
								strokeDasharray="3 3"
								stroke="var(--color-panel-border)"
							/>
							<XAxis
								type="number"
								dataKey="matriculas"
								name="Matrículas"
								domain={[0, tetoMatriculas]}
								tickFormatter={(valor: number) => numero.format(valor)}
								label={{
									value: 'Matrículas',
									position: 'insideBottom',
									offset: -12,
									fill: 'var(--color-panel-muted)'
								}}
							/>
							<YAxis
								type="number"
								dataKey="taxa"
								name={rotuloTaxa}
								domain={escala.dominio}
								ticks={escala.marcas}
								tickFormatter={formatarTaxa}
								width={estreito ? 48 : 60}
							/>
							<ReferenceLine y={0} stroke="var(--color-panel-muted)" />
							{referencia !== null && (
								<ReferenceLine
									y={referencia}
									stroke="var(--color-panel-secondary)"
									strokeDasharray="6 4"
									strokeWidth={1.5}
									label={{
										value: `Alta evasão: ${formatarTaxa(referencia)}`,
										position: 'insideTopRight',
										fill: 'var(--color-panel-secondary)',
										fontSize: 12
									}}
								/>
							)}
							<Tooltip
								cursor={{ strokeDasharray: '3 3' }}
								content={({ active, payload }) => {
									const ponto = active
										? (payload?.[0]?.payload as PontoDispersao | undefined)
										: undefined
									if (!ponto) return null
									return (
										<div className="rounded border border-panel-line bg-panel-surface p-3 text-sm shadow-lg">
											<p className="mb-1 font-semibold">{ponto.rotulo}</p>
											<p>Matrículas: {numero.format(ponto.matriculas)}</p>
											<p>
												{rotuloTaxa}: {formatarTaxa(ponto.taxa)}
											</p>
											<p>
												Base de risco:{' '}
												{ponto.base === null
													? 'Não disponível'
													: numero.format(ponto.base)}
											</p>
											<p className="mt-1 text-panel-muted">
												{series[ponto.serie].rotulo}
											</p>
										</div>
									)
								}}
							/>
							{(['pequena', 'significativa', 'critica'] as const).map(
								(serie) => (
									<Scatter
										key={serie}
										name={series[serie].rotulo}
										data={dadosSeries[serie]}
										fill={series[serie].cor}
										shape={FormaPonto}
										isAnimationActive={false}
										onClick={selecionar}
									/>
								)
							)}
						</ScatterChart>
					</ResponsiveContainer>
					<ul className="m-0 mt-2 flex list-none flex-wrap gap-x-6 gap-y-2 p-0 text-sm">
						{(['critica', 'significativa', 'pequena'] as const).map((serie) => (
							<li key={serie} className="flex items-center gap-2">
								<svg
									width="16"
									height="16"
									className="shrink-0"
									aria-hidden="true"
								>
									<Marcador serie={serie} x={8} y={8} raio={5} />
								</svg>
								<span>
									<strong className="font-semibold">
										{series[serie].rotulo}
									</strong>{' '}
									<span className="text-panel-muted">
										— {series[serie].descricao}
										{serie === 'pequena' &&
											` (base de risco abaixo de ${dados.referencias.base_minima})`}
									</span>
								</span>
							</li>
						))}
					</ul>
					<figcaption id="dispersao-leitura">
						<Ajuda>
							Cada ponto é um curso: matrículas no eixo horizontal e{' '}
							{rotuloTaxa.toLowerCase()} no vertical. A linha tracejada é a taxa
							do recorte. Clique num curso, aqui ou na tabela, para filtrar o
							resumo e a evolução; clique de novo para remover.
						</Ajuda>
					</figcaption>
				</figure>
			) : (
				<p className={cx(classes.estado, 'my-6')} role="status">
					Nenhum curso deste recorte tem matrículas e {rotuloTaxa.toLowerCase()}{' '}
					disponíveis. Consulte os totais e os avisos abaixo.
				</p>
			)}
			<Tabela
				rotulo="Tabela da dispersão por curso"
				legenda="Matrículas, taxas e zona crítica por curso"
			>
				<thead>
					<tr>
						<th scope="col" className={classesTabela.cabecalho}>
							Curso
						</th>
						<th scope="col" className={classesTabela.cabecalhoNumero}>
							Matrículas
						</th>
						<th scope="col" className={classesTabela.cabecalhoNumero}>
							Base de risco
						</th>
						<th scope="col" className={classesTabela.cabecalhoNumero}>
							Evasão do curso
						</th>
						<th scope="col" className={classesTabela.cabecalhoNumero}>
							Evasão da instituição
						</th>
						<th scope="col" className={classesTabela.cabecalho}>
							Zona crítica ({rotuloTaxa.toLowerCase()})
						</th>
						<th scope="col" className={classesTabela.cabecalho}>
							Qualidade
						</th>
					</tr>
				</thead>
				<tbody>
					{dados.cursos.map((curso) => {
						const codigo = curso.curso.codigo
						const rotulo = rotuloCurso(curso.curso)
						const selecionado = !!codigo && codigo === destaque
						return (
							<tr
								key={codigo ?? '__sem_identificador__'}
								className={classesLinha(
									selecionado,
									!!codigo && codigo === ativo
								)}
								onMouseEnter={() => setAtivo(codigo)}
								onMouseLeave={() => setAtivo(null)}
							>
								<th
									scope="row"
									className={cx(
										classesTabela.linhaCabecalho,
										'min-w-[180px] max-w-[280px] wrap-anywhere'
									)}
								>
									{codigo === null ? (
										<>
											{rotulo}
											<span className="sr-only">
												{' '}
												(sem identificador, não filtrável)
											</span>
										</>
									) : (
										<button
											type="button"
											className={classesLinkFiltro}
											aria-pressed={selecionado}
											aria-label={`Filtrar por ${rotulo}`}
											onFocus={() => setAtivo(codigo)}
											onBlur={() => setAtivo(null)}
											onClick={() => onSelecionar(codigo)}
										>
											{rotulo}
										</button>
									)}
								</th>
								<CelulaNumero valor={curso.totais.matriculas_total} />
								<CelulaNumero valor={curso.base_risco} />
								<CelulaTaxa valor={curso.taxas.evasao_curso} />
								<CelulaTaxa valor={curso.taxas.evasao_ies} />
								<td className={classesTabela.texto}>
									{curso.zona_critica[taxa] ? 'Sim' : 'Não'}
								</td>
								<td className={classesTabela.texto}>
									<ListaAvisos avisos={avisosDoRecorte(curso)} />
								</td>
							</tr>
						)
					})}
				</tbody>
			</Tabela>
			<NotaTabela
				exportar={{
					arquivo: `evasao-mt-dispersao-${parametros.ano}.csv`,
					rotulo: 'Baixar CSV da dispersão por curso',
					gerar: () => csvDispersao(dados.cursos, descreverRecorte(parametros))
				}}
			/>
		</>
	)
}
