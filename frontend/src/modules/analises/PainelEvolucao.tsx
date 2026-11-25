import {
	lazy,
	Suspense,
	useEffect,
	useRef,
	useState,
	type FormEvent
} from 'react'
import { Button } from 'primereact/button'
import { InputText } from 'primereact/inputtext'
import { Message } from 'primereact/message'
import { Carregando, GraficoCarregando } from '../../lib/Estados'
import { exibicao } from '../../lib/exibicao'
import { mensagemErro } from '../../lib/http'
import { LimiteErro } from '../../lib/LimiteErro'
import { Ajuda, classes, cx } from '../../lib/ui'
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
			className={classes.secao}
			aria-labelledby="evolucao-titulo"
			aria-busy={carregando}
		>
			<div className={classes.cabecalhoSecao}>
				<h2 id="evolucao-titulo" className={classes.titulo}>
					Evolução temporal
				</h2>
				<form
					className="flex flex-wrap items-end gap-3"
					onSubmit={aplicar}
					noValidate
					aria-describedby="periodo-ajuda"
				>
					{(['ano_inicial', 'ano_final'] as const).map((campo) => (
						<div className="w-28" key={campo}>
							<label className={classes.rotulo} htmlFor={campo}>
								{campo === 'ano_inicial' ? 'Ano inicial' : 'Ano final'}
							</label>
							<InputText
								id={campo}
								name={campo}
								autoComplete="off"
								ref={(elemento) => {
									camposPeriodo.current[campo] = elemento
								}}
								inputMode="numeric"
								keyfilter="pint"
								maxLength={4}
								required
								value={campos[campo]}
								disabled={indisponivel || !anos.length}
								invalid={campoComErro === campo}
								aria-invalid={campoComErro === campo}
								aria-describedby={
									erroPeriodo ? 'periodo-erro' : 'periodo-ajuda'
								}
								onChange={(event) => {
									setRascunho({ ...campos, [campo]: event.target.value })
									setErroPeriodo('')
								}}
							/>
						</div>
					))}
					<Button
						type="submit"
						label="Aplicar período"
						disabled={indisponivel || !anos.length}
					/>
				</form>
			</div>
			<Ajuda>
				As taxas de cada ano no período escolhido. Os filtros são
				compartilhados; o ano do resumo não limita este gráfico.
			</Ajuda>
			<Ajuda id="periodo-ajuda">
				De 1 a 30 anos, incluindo os extremos. Anos sem dados permanecem como
				lacunas.
			</Ajuda>
			{erroPeriodo && (
				<Message
					id="periodo-erro"
					className="my-4"
					severity="error"
					text={erroPeriodo}
				/>
			)}
			<div aria-live="polite">
				{indisponivel && (
					<p className={cx(classes.estado, 'mt-4')}>
						Aguardando o catálogo de filtros. Em caso de falha, use “Atualizar
						dados”.
					</p>
				)}
				{!indisponivel && !anos.length && (
					<p className={cx(classes.estado, 'mt-4')}>
						Nenhum ano está disponível na base conectada.
					</p>
				)}
				{carregando && !ultima && (
					<div className="mt-4">
						<Carregando texto="Carregando evolução temporal…" />
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
									label="Tentar novamente"
									outlined
									size="small"
									onClick={() => setTentativa((valor) => valor + 1)}
								/>
							</>
						}
					/>
				)}
			</div>
			{exibida && (
				<div
					className={cx(atualizando && classes.atualizando)}
					aria-busy={atualizando || undefined}
				>
					<p className={cx(classes.contagem, 'mt-3')}>
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
