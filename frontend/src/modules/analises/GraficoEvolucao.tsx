import {
	CartesianGrid,
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
import { avisosDoRecorte, escalaTaxas, formatarTaxa } from './apresentacao'

const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })
type Taxa = keyof PontoTemporal['taxas']

export function GraficoEvolucao({ serie }: { serie: PontoTemporal[] }) {
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
					className="temporal-chart"
					aria-label="Taxas anuais de evasão"
					aria-describedby="evolucao-leitura"
				>
					<ResponsiveContainer width="100%" height={320}>
						<LineChart
							data={serie}
							accessibilityLayer
							margin={{ top: 16, right: 20, bottom: 12, left: 8 }}
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
								padding={{ left: 24, right: 24 }}
							/>
							<YAxis
								// A escala inclui o zero, como na comparação, para não
								// ampliar diferenças pequenas entre os anos.
								domain={escala.dominio}
								ticks={escala.marcas}
								width={72}
								tickFormatter={formatarTaxa}
							/>
							<ReferenceLine y={0} stroke="var(--panel-muted)" />
							<Tooltip
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
								stroke="var(--panel-green)"
								strokeWidth={3}
								dot={{ r: 4 }}
								label={rotuloIsolado('evasao_curso', 'var(--panel-green)', -8)}
								connectNulls={false}
								isAnimationActive={false}
							/>
							<Line
								name="Evasão da instituição"
								dataKey="taxas.evasao_ies"
								type="linear"
								stroke="var(--panel-secondary)"
								strokeWidth={3}
								strokeDasharray="6 4"
								dot={{ r: 4, strokeDasharray: '0' }}
								label={rotuloIsolado(
									'evasao_ies',
									'var(--panel-secondary)',
									18
								)}
								connectNulls={false}
								isAnimationActive={false}
							/>
						</LineChart>
					</ResponsiveContainer>
					<figcaption id="evolucao-leitura" className="filter-help">
						Lacunas indicam taxas indisponíveis, não zero. Os valores e os
						avisos de cada ano estão na tabela abaixo.
					</figcaption>
				</figure>
			) : (
				<p className="state" role="status">
					{serie.every((ponto) => ponto.qualidade.sem_dados)
						? 'Não há dados de alunos neste período e recorte.'
						: 'Não há taxas disponíveis neste período e recorte. Consulte as bases e os avisos abaixo.'}
				</p>
			)}
			<div
				className="temporal-table table-responsive"
				role="region"
				aria-label="Tabela da evolução temporal"
				tabIndex={0}
			>
				<table className="table caption-top align-top">
					<caption>Valores anuais e qualidade dos dados</caption>
					<thead>
						<tr>
							<th scope="col">Ano</th>
							<th scope="col" className="text-end">
								Base de risco
							</th>
							<th scope="col" className="text-end">
								Evasão do curso
							</th>
							<th scope="col" className="text-end">
								Evasão da instituição
							</th>
							<th scope="col">Qualidade</th>
						</tr>
					</thead>
					<tbody>
						{serie.map((ponto) => {
							const avisos = avisosDoRecorte(ponto)
							return (
								<tr key={ponto.ano}>
									<th scope="row">{ponto.ano}</th>
									<td className="text-end">
										{ponto.base_risco === null
											? 'Não disponível'
											: numero.format(ponto.base_risco)}
									</td>
									<td className="text-end">
										{formatarTaxa(ponto.taxas.evasao_curso)}
									</td>
									<td className="text-end">
										{formatarTaxa(ponto.taxas.evasao_ies)}
									</td>
									<td>
										{avisos.length ? (
											<ul className="annual-notes">
												{avisos.map((aviso) => (
													<li key={aviso}>{aviso}</li>
												))}
											</ul>
										) : (
											'Sem sinalizações'
										)}
									</td>
								</tr>
							)
						})}
					</tbody>
				</table>
			</div>
		</>
	)
}
