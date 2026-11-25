import { useState } from 'react'
import {
	CartesianGrid,
	Dot,
	Legend,
	Line,
	LineChart,
	ReferenceLine,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis
} from 'recharts'
import type { PontoTemporal } from './api'
import {
	FOLGA_EIXO_ANOS,
	anoNoClique,
	avisosDoRecorte,
	escalaTaxas,
	formatarTaxa,
	ordemSeries
} from './apresentacao'
import { Ajuda, classes, cx } from '../../lib/ui'
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
import { csvEvolucao, descreverRecorte } from './exportacao'

type Taxa = keyof PontoTemporal['taxas']

interface Props {
	serie: PontoTemporal[]
	// Parâmetros da consulta, usados para descrever o recorte no CSV.
	parametros: Record<string, string>
	// Ano do resumo e da comparação; anos do catálogo podem ser escolhidos.
	anoSelecionado: number | null
	anosSelecionaveis: number[]
	onSelecionarAno: (ano: number) => void
}

export function GraficoEvolucao({
	serie,
	parametros,
	anoSelecionado,
	anosSelecionaveis,
	onSelecionarAno
}: Props) {
	// Ano sob o ponteiro ou com foco na tabela; liga gráfico e tabela.
	const [ativo, setAtivo] = useState<number | null>(null)
	const anoAtivo = ativo === null ? null : (serie[ativo]?.ano ?? null)
	const selecionavel = (ano: number | null) =>
		ano !== null && anosSelecionaveis.includes(ano)
	function indiceDoEvento(estado: { activeIndex?: unknown }) {
		if (estado.activeIndex == null) return null
		const indice = Number(estado.activeIndex)
		return Number.isInteger(indice) && indice >= 0 ? indice : null
	}
	function selecionar(indice: number | null) {
		const ano = indice === null ? null : (serie[indice]?.ano ?? null)
		if (ano !== null && selecionavel(ano)) onSelecionarAno(ano)
	}
	// Ponto do ano selecionado: maior, preenchido e com anel branco.
	function ponto(cor: string) {
		return (props: {
			cx?: number
			cy?: number
			index?: number
			payload?: PontoTemporal
		}) => {
			const chave = `${cor}-${props.index}`
			if (props.cx == null || props.cy == null) return <g key={chave} />
			const selecionado = props.payload?.ano === anoSelecionado
			return (
				<Dot
					key={chave}
					className="year-dot"
					cx={props.cx}
					cy={props.cy}
					r={selecionado ? 6 : 4}
					fill={selecionado ? cor : '#fff'}
					stroke={selecionado ? '#fff' : cor}
					strokeWidth={2}
				/>
			)
		}
	}
	const temTaxas = serie.some(
		(ponto) =>
			ponto.taxas.evasao_curso !== null || ponto.taxas.evasao_ies !== null
	)
	const anos = serie.map((ponto) => ponto.ano)
	const escala = escalaTaxas(
		serie.flatMap((ponto) => [ponto.taxas.evasao_curso, ponto.taxas.evasao_ies])
	)
	// Um ponto sem vizinhos não forma linha; o valor aparece ao lado dele.
	function rotuloIsolado(taxa: Taxa, cor: string, deslocamento: number) {
		return (props: {
			x?: number | string
			y?: number | string
			index?: number
		}) => {
			const indice = props.index ?? -1
			const valor = serie[indice]?.taxas[taxa] ?? null
			const isolado =
				(serie[indice - 1]?.taxas[taxa] ?? null) === null &&
				(serie[indice + 1]?.taxas[taxa] ?? null) === null
			if (valor === null || !isolado || props.x === undefined) return <g />
			return (
				<text
					x={Number(props.x) + 10}
					y={Number(props.y ?? 0) + deslocamento}
					fill={cor}
					fontSize={13}
					fontWeight={600}
				>
					{formatarTaxa(valor)}
				</text>
			)
		}
	}
	return (
		<>
			{temTaxas ? (
				<figure
					className="my-6 min-w-0 text-sm"
					aria-label="Taxas anuais de evasão"
					aria-describedby="evolucao-leitura"
				>
					<ResponsiveContainer width="100%" height={320}>
						<LineChart
							data={serie}
							accessibilityLayer
							margin={{ top: 24, right: 20, bottom: 12, left: 8 }}
							style={{ cursor: selecionavel(anoAtivo) ? 'pointer' : 'default' }}
							onClick={(estado, evento) => {
								// Ano pela posição do clique; o índice do tooltip fica de reserva.
								const grade = (evento.currentTarget as Element | null)
									?.querySelector('.recharts-cartesian-grid')
									?.getBoundingClientRect()
								const x = (evento as { clientX?: number }).clientX
								const ano =
									grade && typeof x === 'number'
										? anoNoClique(x, grade.left, grade.width, anos)
										: null
								if (ano !== null) {
									if (selecionavel(ano)) onSelecionarAno(ano)
								} else selecionar(indiceDoEvento(estado) ?? ativo)
							}}
							onMouseMove={(estado) => setAtivo(indiceDoEvento(estado))}
							onMouseLeave={() => setAtivo(null)}
						>
							<CartesianGrid strokeDasharray="3 3" vertical={false} />
							<XAxis
								dataKey="ano"
								type="number"
								domain={['dataMin', 'dataMax']}
								ticks={anos}
								minTickGap={24}
								allowDecimals={false}
								tickFormatter={String}
								padding={{ left: FOLGA_EIXO_ANOS, right: FOLGA_EIXO_ANOS }}
							/>
							<YAxis
								// A escala inclui o zero, como na comparação, para não
								// ampliar diferenças pequenas entre os anos.
								domain={escala.dominio}
								ticks={escala.marcas}
								width={72}
								tickFormatter={formatarTaxa}
							/>
							<ReferenceLine y={0} stroke="var(--color-panel-muted)" />
							{anoAtivo !== null && anoAtivo !== anoSelecionado && (
								<ReferenceLine
									x={anoAtivo}
									stroke="var(--color-panel-muted)"
									strokeDasharray="2 4"
								/>
							)}
							{anoSelecionado !== null && anos.includes(anoSelecionado) && (
								<ReferenceLine
									x={anoSelecionado}
									stroke="var(--color-panel-ink)"
									strokeDasharray="4 4"
									label={{
										value: 'Resumo',
										position: 'top',
										fill: 'var(--color-panel-ink)',
										fontSize: 12
									}}
								/>
							)}
							<Tooltip
								itemSorter={ordemSeries}
								formatter={(valor) =>
									typeof valor === 'number'
										? formatarTaxa(valor)
										: 'Não disponível'
								}
								labelFormatter={(ano) => `Ano ${ano}`}
							/>
							<Legend itemSorter={null} />
							<Line
								name="Evasão do curso"
								dataKey="taxas.evasao_curso"
								type="linear"
								stroke="var(--color-panel-green)"
								strokeWidth={3}
								dot={ponto('var(--color-panel-green)')}
								label={rotuloIsolado(
									'evasao_curso',
									'var(--color-panel-green)',
									-8
								)}
								connectNulls={false}
								isAnimationActive={false}
							/>
							<Line
								name="Evasão da instituição"
								dataKey="taxas.evasao_ies"
								type="linear"
								stroke="var(--color-panel-secondary)"
								strokeWidth={3}
								strokeDasharray="6 4"
								dot={ponto('var(--color-panel-secondary)')}
								label={rotuloIsolado(
									'evasao_ies',
									'var(--color-panel-secondary)',
									18
								)}
								connectNulls={false}
								isAnimationActive={false}
							/>
						</LineChart>
					</ResponsiveContainer>
					<figcaption id="evolucao-leitura">
						<Ajuda>
							Lacunas indicam taxas indisponíveis, não zero. Os valores e os
							avisos de cada ano estão na tabela abaixo. Clique num ano para ver
							o resumo e a comparação daquele ano.
						</Ajuda>
					</figcaption>
				</figure>
			) : (
				<p className={cx(classes.estado, 'my-6')} role="status">
					{serie.every((ponto) => ponto.qualidade.sem_dados)
						? 'Não há dados de alunos neste período e recorte.'
						: 'Não há taxas disponíveis neste período e recorte. Consulte as bases e os avisos abaixo.'}
				</p>
			)}
			<Tabela
				rotulo="Tabela da evolução temporal"
				legenda="Valores anuais e qualidade dos dados"
			>
				<thead>
					<tr>
						<th scope="col" className={cx(classesTabela.cabecalho, 'min-w-16')}>
							Ano
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
							Qualidade
						</th>
					</tr>
				</thead>
				<tbody>
					{serie.map((ponto, indice) => (
						<tr
							key={ponto.ano}
							className={classesLinha(
								ponto.ano === anoSelecionado,
								indice === ativo
							)}
							onMouseEnter={() => setAtivo(indice)}
							onMouseLeave={() => setAtivo(null)}
						>
							<th
								scope="row"
								className={cx(classesTabela.linhaCabecalho, 'min-w-16')}
							>
								{selecionavel(ponto.ano) ? (
									<button
										type="button"
										className={classesLinkFiltro}
										aria-pressed={ponto.ano === anoSelecionado}
										aria-label={`Ver ${ponto.ano} no resumo e na comparação`}
										onFocus={() => setAtivo(indice)}
										onBlur={() => setAtivo(null)}
										onClick={() => onSelecionarAno(ponto.ano)}
									>
										{ponto.ano}
									</button>
								) : (
									ponto.ano
								)}
							</th>
							<CelulaNumero valor={ponto.base_risco} />
							<CelulaTaxa valor={ponto.taxas.evasao_curso} />
							<CelulaTaxa valor={ponto.taxas.evasao_ies} />
							<td className={classesTabela.texto}>
								<ListaAvisos avisos={avisosDoRecorte(ponto)} />
							</td>
						</tr>
					))}
				</tbody>
			</Tabela>
			<NotaTabela
				exportar={{
					arquivo: `evasao-mt-evolucao-${parametros.ano_inicial}-${parametros.ano_final}.csv`,
					rotulo: 'Baixar CSV da evolução temporal',
					gerar: () => csvEvolucao(serie, descreverRecorte(parametros))
				}}
			/>
		</>
	)
}
