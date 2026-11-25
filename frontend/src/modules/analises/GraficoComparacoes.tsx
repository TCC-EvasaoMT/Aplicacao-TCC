import {
	Bar,
	BarChart,
	CartesianGrid,
	LabelList,
	Legend,
	Rectangle,
	ReferenceLine,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
	type BarShapeProps
} from 'recharts'
import { useState } from 'react'
import { useMedia } from '../../lib/useMedia'
import type { GrupoComparacao } from './api'
import {
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
	// Valor do grupo usado como filtro ('' quando nenhum).
	destaque: string
	onSelecionar: (valor: string) => void
}

export function GraficoComparacoes({
	grupos,
	parametros,
	destaque,
	onSelecionar
}: Props) {
	// Grupo sob o ponteiro ou com foco na tabela; liga gráfico e tabela.
	const [ativo, setAtivo] = useState<number | null>(null)
	const indiceDestaque = destaque
		? grupos.findIndex(({ grupo }) => grupo.valor === destaque)
		: -1
	const filtravel = (indice: number | null) =>
		indice !== null && (grupos[indice]?.grupo.valor ?? null) !== null
	function selecionar(indice: number | null) {
		const valor = indice === null ? null : (grupos[indice]?.grupo.valor ?? null)
		if (valor !== null) onSelecionar(valor)
	}
	function indiceDoEvento(estado: { activeIndex?: unknown }) {
		if (estado.activeIndex == null) return null
		const indice = Number(estado.activeIndex)
		return Number.isInteger(indice) && indice >= 0 ? indice : null
	}
	// Nome do grupo no eixo: também filtra ao clicar. O texto completo
	// aparece ao passar o mouse quando é abreviado.
	function rotuloEixo(props: {
		x?: number | string
		y?: number | string
		index?: number
		payload?: { value?: unknown }
	}) {
		const indice = props.index ?? -1
		const texto = String(props.payload?.value ?? '')
		const comum = {
			fill: 'var(--color-panel-ink)',
			fontSize: 13,
			fontWeight: indice === indiceDestaque || estreito ? 600 : 400,
			style: { cursor: filtravel(indice) ? 'pointer' : 'default' },
			onClick: () => selecionar(indice)
		}
		return estreito ? (
			<text x={4} y={Number(props.y) - 26} {...comum}>
				<title>{texto}</title>
				{encurtar(texto, 38)}
			</text>
		) : (
			<text
				x={Number(props.x)}
				y={Number(props.y)}
				dy={4}
				textAnchor="end"
				{...comum}
			>
				<title>{texto}</title>
				{encurtar(texto, 22)}
			</text>
		)
	}
	// Barra selecionada com contorno; as demais esmaecem enquanto há destaque.
	function forma(props: BarShapeProps) {
		const indice = props.index
		const esmaecida = indiceDestaque >= 0 && indice !== indiceDestaque
		const contorno = indice === indiceDestaque ? 2 : indice === ativo ? 1 : 0
		return (
			<Rectangle
				{...props}
				className="comparison-bar"
				style={{ fillOpacity: esmaecida ? 0.45 : 1 }}
				stroke={contorno ? 'var(--color-panel-ink)' : 'none'}
				strokeWidth={contorno}
			/>
		)
	}
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
					className={classes.quadroGrafico}
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
							onMouseMove={(estado) => setAtivo(indiceDoEvento(estado))}
							onMouseLeave={() => setAtivo(null)}
						>
							<CartesianGrid
								strokeDasharray="3 3"
								stroke="var(--color-panel-border)"
								horizontal={false}
							/>
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
									tick={rotuloEixo}
								/>
							) : (
								<YAxis
									type="category"
									dataKey="rotulo"
									width={150}
									interval={0}
									tick={rotuloEixo}
								/>
							)}
							<Tooltip
								cursor={{ fill: 'rgb(21 63 53 / 6%)' }}
								itemSorter={ordemSeries}
								formatter={(valor) =>
									typeof valor === 'number'
										? formatarTaxa(valor)
										: 'Não disponível'
								}
							/>
							<Legend itemSorter={null} />
							<ReferenceLine x={0} stroke="var(--color-panel-muted)" />
							<Bar
								name="Evasão do curso"
								dataKey="taxas.evasao_curso"
								fill="var(--color-panel-green)"
								maxBarSize={20}
								isAnimationActive={false}
								shape={forma}
								cursor="pointer"
								onClick={(_, indice) => selecionar(indice)}
							>
								<LabelList
									dataKey="taxas.evasao_curso"
									position="right"
									formatter={rotuloBarra}
									fill="var(--color-panel-ink)"
									fontSize={12}
								/>
							</Bar>
							<Bar
								name="Evasão da instituição"
								dataKey="taxas.evasao_ies"
								fill="var(--color-panel-secondary)"
								maxBarSize={20}
								isAnimationActive={false}
								shape={forma}
								cursor="pointer"
								onClick={(_, indice) => selecionar(indice)}
							>
								<LabelList
									dataKey="taxas.evasao_ies"
									position="right"
									formatter={rotuloBarra}
									fill="var(--color-panel-ink)"
									fontSize={12}
								/>
							</Bar>
						</BarChart>
					</ResponsiveContainer>
					<figcaption id="comparacao-leitura">
						<Ajuda>
							Em cada grupo, a primeira barra representa a evasão do curso; a
							segunda, da instituição. Taxas indisponíveis ficam sem barra.
							Clique num grupo, aqui ou na tabela, para filtrar o resumo e a
							evolução; clique de novo para remover.
						</Ajuda>
					</figcaption>
				</figure>
			) : (
				<p className={cx(classes.estado, 'my-6')} role="status">
					Não há taxas disponíveis neste recorte. Consulte os totais, as bases e
					os avisos abaixo.
				</p>
			)}
			<Tabela
				rotulo="Tabela de comparação entre grupos"
				legenda="Totais, taxas e qualidade por grupo"
			>
				<thead>
					<tr>
						<th scope="col" className={classesTabela.cabecalho}>
							Grupo
						</th>
						{totais.map(([chave, rotulo]) => (
							<th
								key={chave}
								scope="col"
								className={classesTabela.cabecalhoNumero}
							>
								{rotulo}
							</th>
						))}
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
					{grupos.map((grupo, indice) => {
						const rotulo = rotuloGrupo(grupo.grupo)
						const valor = grupo.grupo.valor
						return (
							<tr
								key={valor ?? '__sem_identificador__'}
								className={classesLinha(
									indice === indiceDestaque,
									indice === ativo
								)}
								onMouseEnter={() => setAtivo(indice)}
								onMouseLeave={() => setAtivo(null)}
							>
								<th
									scope="row"
									className={cx(
										classesTabela.linhaCabecalho,
										'min-w-[180px] max-w-[280px] wrap-anywhere'
									)}
								>
									{valor === null ? (
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
											aria-pressed={indice === indiceDestaque}
											aria-label={`Filtrar por ${rotulo}`}
											onFocus={() => setAtivo(indice)}
											onBlur={() => setAtivo(null)}
											onClick={() => onSelecionar(valor)}
										>
											{rotulo}
										</button>
									)}
								</th>
								{totais.map(([chave]) => (
									<CelulaNumero key={chave} valor={grupo.totais[chave]} />
								))}
								<CelulaNumero valor={grupo.base_risco} />
								<CelulaTaxa valor={grupo.taxas.evasao_curso} />
								<CelulaTaxa valor={grupo.taxas.evasao_ies} />
								<td className={classesTabela.texto}>
									<ListaAvisos avisos={avisosDoRecorte(grupo)} />
								</td>
							</tr>
						)
					})}
				</tbody>
			</Tabela>
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
