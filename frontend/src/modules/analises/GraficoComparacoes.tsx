import {
	Bar,
	BarChart,
	CartesianGrid,
	LabelList,
	Legend,
	ReferenceLine,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis
} from 'recharts'
import { useMedia } from '../../lib/useMedia'
import type { GrupoComparacao } from './api'
import { avisosDoRecorte, escalaTaxas, formatarTaxa } from './apresentacao'
import { CelulaNumero, CelulaTaxa, NotaTabela } from './Celulas'
import { csvComparacao, descreverRecorte } from './exportacao'
import { rotuloGrupo } from './comparacoes'

const encurtar = (texto: string, limite: number) =>
	texto.length > limite ? `${texto.slice(0, limite - 1)}…` : texto
const rotuloBarra = (valor: unknown) =>
	typeof valor === 'number' ? formatarTaxa(valor) : ''

const totais = [
	['vinculos_total', 'Vínculos'],
	['ingressantes_total', 'Ingressantes'],
	['matriculas_total', 'Matrículas'],
	['concluintes_total', 'Concluintes']
] as const

interface Props {
	grupos: GrupoComparacao[]
	// Parâmetros da consulta, usados para descrever o recorte no CSV.
	parametros: Record<string, string>
}

export function GraficoComparacoes({ grupos, parametros }: Props) {
	const dados = grupos.map((grupo) => ({
		...grupo,
		rotulo: rotuloGrupo(grupo.grupo)
	}))
	const temTaxas = grupos.some(
		({ taxas }) => taxas.evasao_curso !== null || taxas.evasao_ies !== null
	)
	const estreito = useMedia('(max-width: 575px)')
	const escala = escalaTaxas(
		grupos.flatMap(({ taxas }) => [taxas.evasao_curso, taxas.evasao_ies])
	)
	return (
		<>
			{temTaxas ? (
				<figure
					className="temporal-chart"
					aria-label="Taxas de evasão por grupo"
					aria-describedby="comparacao-leitura"
				>
					<ResponsiveContainer
						width="100%"
						height={Math.max(220, grupos.length * (estreito ? 88 : 72) + 80)}
					>
						<BarChart
							data={dados}
							layout="vertical"
							accessibilityLayer
							barGap={4}
							margin={{ top: 8, right: 56, bottom: 8, left: 0 }}
						>
							<CartesianGrid strokeDasharray="3 3" horizontal={false} />
							<XAxis
								type="number"
								domain={escala.dominio}
								ticks={escala.marcas}
								tickFormatter={formatarTaxa}
							/>
							{estreito ? (
								// Em telas estreitas, o nome do grupo fica acima das barras,
								// liberando a largura para a escala.
								<YAxis
									type="category"
									dataKey="rotulo"
									width={1}
									interval={0}
									tickLine={false}
									tick={(props: {
										y?: number | string
										payload?: { value?: unknown }
									}) => (
										<text
											x={4}
											y={Number(props.y) - 26}
											fill="var(--panel-ink)"
											fontSize={13}
											fontWeight={600}
										>
											{encurtar(String(props.payload?.value ?? ''), 38)}
										</text>
									)}
								/>
							) : (
								<YAxis
									type="category"
									dataKey="rotulo"
									width={150}
									interval={0}
									tickFormatter={(valor: string) => encurtar(valor, 22)}
								/>
							)}
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
								maxBarSize={20}
								isAnimationActive={false}
							>
								<LabelList
									dataKey="taxas.evasao_curso"
									position="right"
									formatter={rotuloBarra}
									fill="var(--panel-ink)"
									fontSize={12}
								/>
							</Bar>
							<Bar
								name="Evasão da instituição"
								dataKey="taxas.evasao_ies"
								fill="var(--panel-secondary)"
								maxBarSize={20}
								isAnimationActive={false}
							>
								<LabelList
									dataKey="taxas.evasao_ies"
									position="right"
									formatter={rotuloBarra}
									fill="var(--panel-ink)"
									fontSize={12}
								/>
							</Bar>
						</BarChart>
					</ResponsiveContainer>
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
										<CelulaNumero key={chave} valor={grupo.totais[chave]} />
									))}
									<CelulaNumero valor={grupo.base_risco} />
									<CelulaTaxa valor={grupo.taxas.evasao_curso} />
									<CelulaTaxa valor={grupo.taxas.evasao_ies} />
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
			<NotaTabela
				exportar={{
					arquivo: `evasao-mt-comparacao-${parametros.agrupar_por}-${parametros.ano}.csv`,
					rotulo: 'Baixar CSV da comparação entre grupos',
					gerar: () => csvComparacao(grupos, descreverRecorte(parametros))
				}}
			/>
		</>
	)
}
