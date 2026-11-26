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
import { Ajuda, classes } from '../../lib/ui'
import { useMedia } from '../../lib/useMedia'
import type { Coorte } from './api'
import {
	FOLGA_EIXO_ANOS,
	escalaTaxas,
	formatarTaxa,
	plural
} from './apresentacao'
import {
	CelulaNumero,
	CelulaTaxa,
	classesTabela,
	ListaAvisos,
	NotaTabela,
	Tabela
} from './Celulas'
import { avisosTurma, taxasTurma, type TaxaTurma } from './coorte'
import { csvCoorte, descreverRecorte } from './exportacao'

interface Props {
	coorte: Coorte & { tamanho_inicial: number }
	anoIngresso: number
	taxa: TaxaTurma
	parametros: Record<string, string>
}

export function GraficoCoorte({
	coorte,
	anoIngresso,
	taxa,
	parametros
}: Props) {
	const estreito = useMedia('(max-width: 575px)')
	const rotuloEvasao = taxasTurma.find((t) => t.valor === taxa)!.rotulo
	const serie = coorte.serie
	const anos = serie.map((p) => p.ano)
	const escala = escalaTaxas(
		serie.flatMap((p) => [p.taxas[taxa], p.taxas.concluiu, p.taxas.continua])
	)
	const series = [
		{
			nome: rotuloEvasao,
			chave: `taxas.${taxa}`,
			cor: 'var(--color-panel-green)',
			traco: undefined
		},
		{
			nome: 'Já concluiu',
			chave: 'taxas.concluiu',
			cor: 'var(--color-panel-secondary)',
			traco: '6 4'
		},
		{
			nome: 'Continua no curso',
			chave: 'taxas.continua',
			cor: 'var(--color-panel-muted)',
			traco: '2 4'
		}
	]
	return (
		<>
			<figure
				className={classes.quadroGrafico}
				aria-label={`Turma de ${anoIngresso} ao longo dos censos`}
				aria-describedby="turma-leitura"
			>
				<ResponsiveContainer width="100%" height={estreito ? 300 : 360}>
					<LineChart
						data={serie}
						accessibilityLayer
						margin={{ top: 16, right: 20, bottom: 12, left: 8 }}
					>
						<CartesianGrid
							strokeDasharray="3 3"
							stroke="var(--color-panel-border)"
							vertical={false}
						/>
						<XAxis
							dataKey="ano"
							type="number"
							domain={['dataMin', 'dataMax']}
							ticks={anos}
							allowDecimals={false}
							tickFormatter={String}
							padding={{ left: FOLGA_EIXO_ANOS, right: FOLGA_EIXO_ANOS }}
						/>
						<YAxis
							domain={escala.dominio}
							ticks={escala.marcas}
							width={72}
							tickFormatter={formatarTaxa}
						/>
						<ReferenceLine y={0} stroke="var(--color-panel-muted)" />
						<Tooltip
							formatter={(valor) =>
								typeof valor === 'number'
									? formatarTaxa(valor)
									: 'Não disponível'
							}
							labelFormatter={(ano) => `Censo ${ano}`}
						/>
						<Legend itemSorter={null} />
						{series.map((s) => (
							<Line
								key={s.chave}
								name={s.nome}
								dataKey={s.chave}
								type="linear"
								stroke={s.cor}
								strokeWidth={s.traco ? 2.5 : 3.5}
								strokeDasharray={s.traco}
								dot={{ r: 4, fill: '#fff', stroke: s.cor, strokeWidth: 2 }}
								connectNulls={false}
								isAnimationActive={false}
							/>
						))}
					</LineChart>
				</ResponsiveContainer>
				<figcaption id="turma-leitura">
					<Ajuda>
						Proporções do tamanho inicial da turma em cada censo. Lacunas
						indicam anos sem os dados da turma, não zero; os valores, o resíduo
						e os avisos estão na tabela abaixo.
					</Ajuda>
				</figcaption>
			</figure>
			<Tabela
				rotulo={`Tabela da turma de ${anoIngresso}`}
				legenda={`Turma de ${anoIngresso}: proporções do tamanho inicial por ano do censo`}
			>
				<thead>
					<tr>
						<th scope="col" className={classesTabela.cabecalho}>
							Censo
						</th>
						<th scope="col" className={classesTabela.cabecalhoNumero}>
							Vínculos
						</th>
						<th scope="col" className={classesTabela.cabecalhoNumero}>
							{rotuloEvasao}
						</th>
						<th scope="col" className={classesTabela.cabecalhoNumero}>
							Já concluiu
						</th>
						<th scope="col" className={classesTabela.cabecalhoNumero}>
							Continua
						</th>
						<th scope="col" className={classesTabela.cabecalhoNumero}>
							Resíduo
						</th>
						<th scope="col" className={classesTabela.cabecalho}>
							Qualidade
						</th>
					</tr>
				</thead>
				<tbody>
					{serie.map((p) => (
						<tr key={p.ano}>
							<th scope="row" className={classesTabela.linhaCabecalho}>
								{p.ano}
								<span className="block text-xs font-normal text-panel-muted">
									{p.anos_desde_ingresso === 0
										? 'ingresso'
										: `+${p.anos_desde_ingresso} ${p.anos_desde_ingresso === 1 ? 'ano' : 'anos'}`}
								</span>
							</th>
							<CelulaNumero valor={p.totais.vinculos_total} />
							<CelulaTaxa valor={p.taxas[taxa]} />
							<CelulaTaxa valor={p.taxas.concluiu} />
							<CelulaTaxa valor={p.taxas.continua} />
							<CelulaTaxa valor={p.taxas.residuo} />
							<td className={classesTabela.texto}>
								<ListaAvisos avisos={avisosTurma(p, plural)} />
							</td>
						</tr>
					))}
				</tbody>
			</Tabela>
			<NotaTabela
				exportar={{
					arquivo: `evasao-mt-turma-${anoIngresso}.csv`,
					rotulo: `Baixar CSV da turma de ${anoIngresso}`,
					gerar: () =>
						csvCoorte(
							anoIngresso,
							coorte.tamanho_inicial,
							serie,
							descreverRecorte(parametros)
						)
				}}
			/>
		</>
	)
}
