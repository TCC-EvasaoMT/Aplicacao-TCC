import {
	CartesianGrid,
	Legend,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis
} from 'recharts'
import type { PontoTemporal } from './api'
import { avisosDoAno, formatarTaxa } from './apresentacao'

const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })

export function GraficoEvolucao({ serie }: { serie: PontoTemporal[] }) {
	const temTaxas = serie.some(
		(ponto) =>
			ponto.taxas.evasao_curso !== null || ponto.taxas.evasao_ies !== null
	)
	const anos = serie.map((ponto) => ponto.ano)
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
							/>
							<YAxis
								domain={['auto', 'auto']}
								width={72}
								tickFormatter={formatarTaxa}
							/>
							<Tooltip
								formatter={(valor) =>
									typeof valor === 'number'
										? formatarTaxa(valor)
										: 'Não disponível'
								}
								labelFormatter={(ano) => `Ano ${ano}`}
							/>
							<Legend />
							<Line
								name="Evasão do curso"
								dataKey="taxas.evasao_curso"
								type="linear"
								stroke="#17634e"
								strokeWidth={3}
								dot={{ r: 4 }}
								connectNulls={false}
								isAnimationActive={false}
							/>
							<Line
								name="Evasão da IES"
								dataKey="taxas.evasao_ies"
								type="linear"
								stroke="#805128"
								strokeWidth={3}
								strokeDasharray="6 4"
								dot={{ r: 4 }}
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
				className="temporal-table"
				role="region"
				aria-label="Tabela da evolução temporal"
				tabIndex={0}
			>
				<table>
					<caption>Valores anuais e qualidade dos dados</caption>
					<thead>
						<tr>
							<th scope="col">Ano</th>
							<th scope="col">Base de risco</th>
							<th scope="col">Evasão do curso</th>
							<th scope="col">Evasão da IES</th>
							<th scope="col">Qualidade</th>
						</tr>
					</thead>
					<tbody>
						{serie.map((ponto) => (
							<tr key={ponto.ano}>
								<th scope="row">{ponto.ano}</th>
								<td>
									{ponto.base_risco === null
										? 'Não disponível'
										: numero.format(ponto.base_risco)}
								</td>
								<td>{formatarTaxa(ponto.taxas.evasao_curso)}</td>
								<td>{formatarTaxa(ponto.taxas.evasao_ies)}</td>
								<td>{avisosDoAno(ponto).join('; ') || 'Sem sinalizações'}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</>
	)
}
