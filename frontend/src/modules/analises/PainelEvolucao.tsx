import {
	lazy,
	Suspense,
	useEffect,
	useRef,
	useState,
	type FormEvent
} from 'react'
import { Carregando, GraficoCarregando } from '../../lib/Estados'
import { LimiteErro } from '../../lib/LimiteErro'
import type { SelecaoFiltros } from '../indicadores'
import { consultarEvolucao, type EvolucaoTemporal } from './api'
import {
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
	atualizacao: number
	indisponivel: boolean
}

export function PainelEvolucao({
	anos,
	selecao,
	atualizacao,
	indisponivel
}: Props) {
	const [periodo, setPeriodo] = useState<Periodo | null>(null)
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

	useEffect(() => {
		carregarGrafico().catch(() => {})
	}, [])

	useEffect(() => {
		if (!podeConsultar) return
		const controller = new AbortController()
		setResposta(null)
		consultarEvolucao(query, controller.signal)
			.then((dados) => {
				if (!controller.signal.aborted) setResposta({ chave, dados })
			})
			.catch(() => {
				if (!controller.signal.aborted)
					setResposta({
						chave,
						erro: 'Não foi possível carregar a evolução temporal.'
					})
			})
		return () => controller.abort()
	}, [query, chave, podeConsultar])

	const atual = resposta?.chave === chave ? resposta : null
	const carregando = podeConsultar && !atual
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
				{carregando && <Carregando texto="Carregando evolução temporal…" />}
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
			{podeConsultar && atual?.dados && (
				<>
					<p className="filter-count">
						Período aplicado: {aplicado.ano_inicial}–{aplicado.ano_final}
					</p>
					<LimiteErro mensagem="Não foi possível exibir o gráfico da evolução temporal.">
						<Suspense fallback={<GraficoCarregando />}>
							<GraficoEvolucao serie={atual.dados.serie} />
						</Suspense>
					</LimiteErro>
				</>
			)}
		</section>
	)
}
