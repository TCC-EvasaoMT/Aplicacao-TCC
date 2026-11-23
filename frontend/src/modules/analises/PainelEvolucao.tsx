import {
	lazy,
	Suspense,
	useEffect,
	useRef,
	useState,
	type FormEvent
} from 'react'
import { Carregando, GraficoCarregando } from '../../lib/Estados'
import { exibicao } from '../../lib/exibicao'
import { mensagemErro } from '../../lib/http'
import { LimiteErro } from '../../lib/LimiteErro'
import type { SelecaoFiltros } from '../indicadores'
import { consultarEvolucao, type EvolucaoTemporal } from './api'
import { gravarUrl, lerUrl } from '../../lib/url'
import {
	lerPeriodo,
	periodoInicial,
	campoInvalidoPeriodo,
	serializarEvolucao,
	validarPeriodo,
	type Periodo
} from './periodo'

// Recharts fica em um chunk separado; o download começa junto com a consulta.
const carregarGrafico = () => import('./GraficoEvolucao')
const GraficoEvolucao = lazy(() =>
	carregarGrafico().then((modulo) => ({ default: modulo.GraficoEvolucao }))
)

interface Props {
	anos: number[]
	selecao: SelecaoFiltros
	onAnoChange: (ano: string) => void
	atualizacao: number
	indisponivel: boolean
}

export function PainelEvolucao({
	anos,
	selecao,
	atualizacao,
	indisponivel,
	onAnoChange
}: Props) {
	const [periodo, setPeriodo] = useState<Periodo | null>(() =>
		lerPeriodo(lerUrl())
	)
	const [rascunho, setRascunho] = useState<Periodo | null>(null)
	const [erroPeriodo, setErroPeriodo] = useState('')
	const camposPeriodo = useRef<
		Partial<Record<keyof Periodo, HTMLInputElement | null>>
	>({})
	const [tentativa, setTentativa] = useState(0)
	const [resposta, setResposta] = useState<{
		chave: string
		dados?: EvolucaoTemporal
		erro?: string
	} | null>(null)
	const padrao = periodoInicial(anos)
	const aplicado = periodo ?? padrao
	const campos = rascunho ?? aplicado
	const campoComErro = erroPeriodo ? campoInvalidoPeriodo(campos) : null
	const query = serializarEvolucao(aplicado, selecao)
	const podeConsultar =
		!indisponivel && anos.length > 0 && !validarPeriodo(aplicado)
	const chave = `${atualizacao}:${tentativa}:${query}`
	// Última série exibida: fica na tela, esmaecida, enquanto o novo recorte
	// carrega, para o gráfico não sumir a cada clique.
	const [ultima, setUltima] = useState<{
		dados: EvolucaoTemporal
		query: string
		periodo: Periodo
	} | null>(null)

	useEffect(() => {
		carregarGrafico().catch(() => {})
	}, [])

	useEffect(() => {
		gravarUrl(
			['ano_inicial', 'ano_final'],
			periodo ? Object.entries(periodo) : []
		)
	}, [periodo])

	useEffect(() => {
		if (!podeConsultar) return
		const controller = new AbortController()
		setResposta(null)
		consultarEvolucao(query, controller.signal)
			.then((dados) => {
				if (controller.signal.aborted) return
				setResposta({ chave, dados })
				setUltima({ dados, query, periodo: aplicado })
			})
			.catch((falha) => {
				if (!controller.signal.aborted)
					setResposta({
						chave,
						erro: mensagemErro(
							falha,
							'Não foi possível carregar a evolução temporal.'
						)
					})
			})
		return () => controller.abort()
	}, [query, chave, podeConsultar])

	const atual = resposta?.chave === chave ? resposta : null
	const carregando = podeConsultar && !atual
	const vista = podeConsultar
		? exibicao(
				atual?.dados
					? { dados: atual.dados, query, periodo: aplicado }
					: undefined,
				ultima,
				carregando
			)
		: { dado: null, atualizando: false }
	const exibida = vista.dado
	const atualizando = vista.atualizando
	function aplicar(event: FormEvent) {
		event.preventDefault()
		const erro = validarPeriodo(campos)
		setErroPeriodo(erro)
		if (!erro) setPeriodo({ ...campos })
		else {
			const campo = campoInvalidoPeriodo(campos)
			if (campo) camposPeriodo.current[campo]?.focus()
		}
	}

	return (
		<section
			className="temporal"
			aria-labelledby="evolucao-titulo"
			aria-busy={carregando}
		>
			<h2 id="evolucao-titulo">Evolução temporal</h2>
			<p className="filter-help">
				Compare as taxas no período abaixo. Os filtros são compartilhados; o ano
				do resumo não limita este gráfico.
			</p>
			<form
				className="row g-3 align-items-end"
				onSubmit={aplicar}
				noValidate
				aria-describedby="periodo-ajuda"
			>
				{(['ano_inicial', 'ano_final'] as const).map((campo) => (
					<div className="col-6 col-sm-4 col-lg-2" key={campo}>
						<label className="form-label" htmlFor={campo}>
							{campo === 'ano_inicial' ? 'Ano inicial' : 'Ano final'}
						</label>
						<input
							className={`form-control${campoComErro === campo ? ' is-invalid' : ''}`}
							id={campo}
							name={campo}
							autoComplete="off"
							ref={(elemento) => {
								camposPeriodo.current[campo] = elemento
							}}
							type="number"
							min={1900}
							max={9999}
							step={1}
							required
							value={campos[campo]}
							disabled={indisponivel || !anos.length}
							aria-invalid={campoComErro === campo}
							aria-describedby={erroPeriodo ? 'periodo-erro' : 'periodo-ajuda'}
							onChange={(event) => {
								setRascunho({ ...campos, [campo]: event.target.value })
								setErroPeriodo('')
							}}
						/>
					</div>
				))}
				<div className="col-12 col-sm-auto">
					<button
						className="btn btn-success"
						disabled={indisponivel || !anos.length}
						type="submit"
					>
						Aplicar período
					</button>
				</div>
			</form>
			<p id="periodo-ajuda" className="filter-help">
				De 1 a 30 anos, incluindo os extremos. Anos sem dados permanecem como
				lacunas.
			</p>
			{erroPeriodo && (
				<p id="periodo-erro" className="alert alert-danger" role="alert">
					{erroPeriodo}
				</p>
			)}
			<div aria-live="polite">
				{indisponivel && (
					<p className="state">
						Aguardando o catálogo de filtros. Em caso de falha, use “Atualizar
						dados”.
					</p>
				)}
				{!indisponivel && !anos.length && (
					<p className="state">Nenhum ano está disponível na base conectada.</p>
				)}
				{carregando && !ultima && (
					<Carregando texto="Carregando evolução temporal…" />
				)}
				{podeConsultar && atual?.erro && (
					<div className="alert alert-danger" role="alert">
						<p>{atual.erro}</p>
						<button
							className="btn btn-outline-success btn-sm"
							onClick={() => setTentativa((valor) => valor + 1)}
						>
							Tentar novamente
						</button>
					</div>
				)}
			</div>
			{exibida && (
				<div
					className={atualizando ? 'is-refreshing' : undefined}
					aria-busy={atualizando || undefined}
				>
					<p className="filter-count">
						Período aplicado: {exibida.periodo.ano_inicial} a{' '}
						{exibida.periodo.ano_final}
					</p>
					<LimiteErro mensagem="Não foi possível exibir o gráfico da evolução temporal.">
						<Suspense fallback={<GraficoCarregando />}>
							<GraficoEvolucao
								serie={exibida.dados.serie}
								parametros={Object.fromEntries(
									new URLSearchParams(exibida.query)
								)}
								anoSelecionado={selecao.ano ? Number(selecao.ano) : null}
								anosSelecionaveis={anos}
								onSelecionarAno={(ano) => onAnoChange(String(ano))}
							/>
						</Suspense>
					</LimiteErro>
				</div>
			)}
		</section>
	)
}
