import {
	Bar,
	BarChart,
	CartesianGrid,
	Legend,
	ReferenceLine,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis
} from 'recharts'
import type { GrupoComparacao } from './api'
import { avisosDoRecorte, formatarTaxa } from './apresentacao'
import { rotuloGrupo } from './comparacoes'

const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })
const totais = [
	['vinculos_total', 'Vínculos'],
	['ingressantes_total', 'Ingressantes'],
	['matriculas_total', 'Matrículas'],
	['concluintes_total', 'Concluintes']
] as const

export function GraficoComparacoes({ grupos }: { grupos: GrupoComparacao[] }) {
	const dados = grupos.map((grupo) => ({
		...grupo,
		rotulo: rotuloGrupo(grupo.grupo)
	}))
	const temTaxas = grupos.some(
		({ taxas }) => taxas.evasao_curso !== null || taxas.evasao_ies !== null
	)
	return (
		<>
			{temTaxas ? (
				<figure
					className="temporal-chart"
					aria-label="Taxas de evasão por grupo"
					aria-describedby="comparacao-leitura"
				>
					<p className="filter-help comparison-scroll-help">
						Deslize o gráfico para ver toda a escala. A tabela abaixo também
						permite rolagem horizontal.
					</p>
					<div
						className="comparison-chart-scroll"
						role="region"
						aria-label="Gráfico comparativo com rolagem horizontal"
						tabIndex={0}
					>
						<div className="comparison-chart">
							<ResponsiveContainer
								width="100%"
								height={Math.max(220, grupos.length * 72 + 80)}
							>
								<BarChart
									data={dados}
									layout="vertical"
									accessibilityLayer
									margin={{ top: 8, right: 36, bottom: 8, left: 0 }}
								>
									<CartesianGrid strokeDasharray="3 3" horizontal={false} />
									<XAxis
										type="number"
										domain={([minimo, maximo]: readonly [number, number]) => [
											Math.min(0, minimo),
											Math.max(0, maximo)
										]}
										tickFormatter={formatarTaxa}
									/>
									<YAxis
										type="category"
										dataKey="rotulo"
										width={150}
										interval={0}
										tickFormatter={(valor: string) =>
											valor.length > 22 ? `${valor.slice(0, 21)}…` : valor
										}
									/>
									<Tooltip
										formatter={(valor) =>
											typeof valor === 'number'
												? formatarTaxa(valor)
												: 'Não disponível'
										}
									/>
									<Legend itemSorter={null} />
									<ReferenceLine x={0} stroke="var(--panel-muted)" />
									<Bar
										name="Evasão do curso"
										dataKey="taxas.evasao_curso"
										fill="var(--panel-green)"
										maxBarSize={18}
										isAnimationActive={false}
									/>
									<Bar
										name="Evasão da instituição"
										dataKey="taxas.evasao_ies"
										fill="var(--panel-secondary)"
										maxBarSize={18}
										isAnimationActive={false}
									/>
								</BarChart>
							</ResponsiveContainer>
						</div>
					</div>
					<figcaption className="filter-help" id="comparacao-leitura">
						Em cada grupo, a primeira barra representa a evasão do curso; a
						segunda, da instituição. Taxas indisponíveis ficam sem barra.
						Consulte valores e avisos na tabela.
					</figcaption>
				</figure>
			) : (
				<p className="state" role="status">
					Não há taxas disponíveis neste recorte. Consulte os totais, as bases e
					os avisos abaixo.
				</p>
			)}
			<div
				className="temporal-table comparison-table table-responsive"
				role="region"
				aria-label="Tabela de comparação entre grupos"
				tabIndex={0}
			>
				<table className="table caption-top align-top">
					<caption>Totais, taxas e qualidade por grupo</caption>
					<thead>
						<tr>
							<th scope="col">Grupo</th>
							{totais.map(([chave, rotulo]) => (
								<th key={chave} scope="col" className="text-end">
									{rotulo}
								</th>
							))}
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
						{grupos.map((grupo) => {
							const avisos = avisosDoRecorte(grupo)
							return (
								<tr key={grupo.grupo.valor ?? '__sem_identificador__'}>
									<th scope="row">{rotuloGrupo(grupo.grupo)}</th>
									{totais.map(([chave]) => (
										<td key={chave} className="text-end">
											{grupo.totais[chave] === null
												? 'Não disponível'
												: numero.format(grupo.totais[chave])}
										</td>
									))}
									<td className="text-end">
										{grupo.base_risco === null
											? 'Não disponível'
											: numero.format(grupo.base_risco)}
									</td>
									<td className="text-end">
										{formatarTaxa(grupo.taxas.evasao_curso)}
									</td>
									<td className="text-end">
										{formatarTaxa(grupo.taxas.evasao_ies)}
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
