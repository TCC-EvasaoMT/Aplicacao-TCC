import { lazy, Suspense, useEffect, useState } from 'react'
import { Button } from 'primereact/button'
import { Message } from 'primereact/message'
import { Carregando, GraficoCarregando } from '../../lib/Estados'
import { exibicao } from '../../lib/exibicao'
import { mensagemErro } from '../../lib/http'
import { LimiteErro } from '../../lib/LimiteErro'
import { CampoLista } from '../../lib/CampoLista'
import { Ajuda, Aviso, classes, cx } from '../../lib/ui'
import { gravarUrl, lerUrl } from '../../lib/url'
import type { Catalogo } from '../catalogos'
import type { SelecaoFiltros } from '../indicadores'
import { consultarDispersao, type Dispersao, type TaxaDispersao } from './api'
import { formatarTaxa, plural } from './apresentacao'
import { alternarFiltroGrupo } from './comparacoes'
import {
	contagensDispersao,
	lerTaxaDispersao,
	serializarDispersao,
	taxasDispersao
} from './dispersao'

// Recharts fica em um chunk separado; o download começa junto com a consulta.
const carregarGrafico = () => import('./GraficoDispersao')
const GraficoDispersao = lazy(() =>
	carregarGrafico().then((modulo) => ({ default: modulo.GraficoDispersao }))
)

interface Props {
	catalogo: Catalogo | null
	selecao: SelecaoFiltros
	atualizacao: number
	indisponivel: boolean
	onAnoChange: (ano: string) => void
	onSelecaoChange: (selecao: SelecaoFiltros) => void
}

export function PainelDispersao({
	catalogo,
	selecao,
	atualizacao,
	indisponivel,
	onAnoChange,
	onSelecaoChange
}: Props) {
	const [taxa, setTaxa] = useState<TaxaDispersao>(() =>
		lerTaxaDispersao(lerUrl())
	)
	const [tentativa, setTentativa] = useState(0)
	const [resposta, setResposta] = useState<{
		chave: string
		dados?: Dispersao
		erro?: string
	} | null>(null)
	const [ultima, setUltima] = useState<{
		dados: Dispersao
		query: string
		ano: string
	} | null>(null)
	const query = serializarDispersao(selecao)
	const chave = `${atualizacao}:${tentativa}:${query}`
	const podeConsultar =
		!indisponivel && !!catalogo?.anos.includes(Number(selecao.ano))
	const atual = resposta?.chave === chave ? resposta : null
	const carregando = podeConsultar && !atual
	// Enquanto o novo recorte carrega, a última dispersão fica na tela,
	// esmaecida.
	const vista = podeConsultar
		? exibicao(
				atual?.dados
					? { dados: atual.dados, query, ano: selecao.ano }
					: undefined,
				ultima,
				carregando
			)
		: { dado: null, atualizando: false }
	const exibida = vista.dado
	const dados = exibida?.dados
	const contagens = dados ? contagensDispersao(dados, taxa) : null
	const referencia = dados?.referencias.alta_evasao[taxa] ?? null
	const foraDaReferencia =
		dados?.referencias.cursos_fora_da_referencia[taxa] ?? 0
	const rotuloTaxa =
		taxasDispersao.find((opcao) => opcao.valor === taxa)?.rotulo ?? ''
	const destaque = selecao.codigo_curso
	const destaqueAusente =
		!!destaque &&
		!!dados &&
		!dados.cursos.some(({ curso }) => curso.codigo === destaque)

	useEffect(() => {
		carregarGrafico().catch(() => {})
	}, [])

	useEffect(() => {
		gravarUrl(
			['taxa_dispersao'],
			taxa === taxasDispersao[0]!.valor ? [] : [['taxa_dispersao', taxa]]
		)
	}, [taxa])

	useEffect(() => {
		if (!podeConsultar) return
		const controller = new AbortController()
		setResposta(null)
		consultarDispersao(query, controller.signal)
			.then((dados) => {
				if (controller.signal.aborted) return
				setResposta({ chave, dados })
				setUltima({ dados, query, ano: selecao.ano })
			})
			.catch((falha) => {
				if (!controller.signal.aborted)
					setResposta({
						chave,
						erro: mensagemErro(falha, 'Não foi possível carregar a dispersão.')
					})
			})
		return () => controller.abort()
	}, [query, chave, podeConsultar])

	const opcoesAno = catalogo?.anos.length
		? catalogo.anos.map((ano) => ({ value: String(ano), label: String(ano) }))
		: [{ value: '', label: 'Sem anos disponíveis' }]

	return (
		<section
			className={classes.secao}
			aria-labelledby="dispersao-titulo"
			aria-busy={carregando}
		>
			<div className={classes.cabecalhoSecao}>
				<h2 id="dispersao-titulo" className={classes.titulo}>
					Dispersão por curso
				</h2>
				<div className="flex flex-wrap items-end gap-3">
					<div className={classes.campoAno}>
						<label className={classes.rotulo} htmlFor="dispersao-ano">
							Ano
						</label>
						<CampoLista
							inputId="dispersao-ano"
							className="max-w-[260px]"
							value={selecao.ano}
							options={opcoesAno}
							disabled={!podeConsultar}
							aria-describedby="dispersao-contexto"
							onChange={onAnoChange}
						/>
					</div>
					<div className="min-w-56">
						<label className={classes.rotulo} htmlFor="dispersao-taxa">
							Taxa no eixo vertical
						</label>
						<CampoLista
							inputId="dispersao-taxa"
							value={taxa}
							options={taxasDispersao.map(({ valor, rotulo }) => ({
								value: valor,
								label: rotulo
							}))}
							onChange={(valor) => setTaxa(valor as TaxaDispersao)}
						/>
					</div>
				</div>
			</div>
			<Ajuda id="dispersao-contexto">
				Relaciona matrículas e evasão de cada curso no ano. O ano é
				compartilhado com o resumo; os filtros do painel também se aplicam aqui,
				exceto o de curso, que destaca o curso escolhido.
			</Ajuda>
			<div aria-live="polite">
				{!podeConsultar && (
					<p className={cx(classes.estado, 'mt-4')}>
						Aguardando anos e filtros disponíveis. Em caso de falha, use
						“Atualizar dados” no resumo.
					</p>
				)}
				{carregando && !ultima && (
					<div className="mt-4">
						<Carregando texto="Carregando dispersão…" />
					</div>
				)}
				{podeConsultar && atual?.erro && (
					<Message
						className="my-4"
						severity="error"
						content={
							<>
								<p className="mb-3">{atual.erro}</p>
								<Button
									label="Tentar dispersão novamente"
									outlined
									size="small"
									onClick={() => setTentativa((valor) => valor + 1)}
								/>
							</>
						}
					/>
				)}
				{exibida && dados && contagens && (
					<div
						className={cx(vista.atualizando && classes.atualizando)}
						aria-busy={vista.atualizando || undefined}
					>
						<h3 className="mt-6 mb-2">
							Cursos em {exibida.ano}:{' '}
							{plural(contagens.cursos, 'curso', 'cursos')}
							{contagens.cursos > 0 &&
								`, ${plural(contagens.criticos, 'na zona crítica', 'na zona crítica')}`}
						</h3>
						{contagens.cursos > 0 && (
							<Ajuda>
								{referencia === null
									? `Sem linha de alta evasão: nenhum curso tem ${rotuloTaxa.toLowerCase()} calculável.`
									: `Linha de alta evasão: ${formatarTaxa(referencia)}, a ${rotuloTaxa.toLowerCase()} do conjunto de cursos com essa taxa, somando antes de dividir.`}{' '}
								Zona crítica: taxa acima da linha e base de risco de pelo menos{' '}
								{dados.referencias.base_minima}. Ordem da tabela por código, sem
								ranking.
							</Ajuda>
						)}
						{foraDaReferencia > 0 && (
							<Aviso>
								<p>
									{plural(foraDaReferencia, 'curso não tem', 'cursos não têm')}{' '}
									{rotuloTaxa.toLowerCase()} calculável (base não positiva,
									medida ausente ou só docentes) e{' '}
									{foraDaReferencia === 1 ? 'ficou' : 'ficaram'} fora da linha
									de referência e do gráfico. Por isso a linha pode diferir da
									taxa do resumo.
								</p>
							</Aviso>
						)}
						{destaqueAusente && (
							<Aviso>
								<p>O curso {destaque} não tem registros neste ano e recorte.</p>
							</Aviso>
						)}
						{contagens.cursos === 0 && (
							<p className={cx(classes.estado, 'mt-4')}>
								Nenhum curso corresponde a este ano e recorte. Altere os filtros
								ou o ano.
							</p>
						)}
					</div>
				)}
			</div>
			{exibida && dados && dados.cursos.length > 0 && (
				<div
					className={cx(vista.atualizando && classes.atualizando)}
					aria-busy={vista.atualizando || undefined}
				>
					<LimiteErro mensagem="Não foi possível exibir o gráfico da dispersão.">
						<Suspense fallback={<GraficoCarregando />}>
							<GraficoDispersao
								dados={dados}
								taxa={taxa}
								parametros={Object.fromEntries(
									new URLSearchParams(exibida.query)
								)}
								destaque={destaque}
								onSelecionar={(codigo) =>
									onSelecaoChange(alternarFiltroGrupo(selecao, 'curso', codigo))
								}
							/>
						</Suspense>
					</LimiteErro>
				</div>
			)}
			<Ajuda className="mt-6">
				Matrículas são cursando mais concluintes. Cursos com base de risco
				pequena aparecem vazados: sua taxa varia muito com poucos alunos e o
				ruído da fonte.
			</Ajuda>
		</section>
	)
}
