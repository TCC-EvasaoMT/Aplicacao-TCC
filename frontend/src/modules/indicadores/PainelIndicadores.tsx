import { useEffect, useState } from 'react'
import { PainelComparacoes, PainelEvolucao } from '../analises'
import { Carregando } from '../../lib/Estados'
import { gravarUrl, lerUrl } from '../../lib/url'
import { consultarCatalogo, type Catalogo } from '../catalogos'
import { consultarResumo, type Resumo } from './api'
import {
	atualizarSelecao,
	camposFiltro,
	lerSelecao,
	limparFiltros,
	serializarFiltros,
	type SelecaoFiltros
} from './filtros'
import { FiltrosIndicadores } from './FiltrosIndicadores'
import { ResumoIndicadores } from './ResumoIndicadores'

export function PainelIndicadores() {
	const [catalogo, setCatalogo] = useState<Catalogo | null>(null)
	const [selecao, setSelecao] = useState(() => lerSelecao(lerUrl()))
	const [carregandoCatalogo, setCarregandoCatalogo] = useState(true)
	const [erroCatalogo, setErroCatalogo] = useState('')
	const [avisoSelecao, setAvisoSelecao] = useState('')
	const [tentativa, setTentativa] = useState(0)
	// Enquanto o ano não foi escolhido pela pessoa, o painel abre no ano mais
	// recente que tem dados de alunos (o catálogo também lista anos só com
	// docentes). Anos pulados são informados na tela.
	const [anoAutomatico, setAnoAutomatico] = useState(() => !lerUrl().get('ano'))
	const [anosPulados, setAnosPulados] = useState<string[]>([])
	const [resposta, setResposta] = useState<{
		chave: string
		dados?: Resumo
		erro?: string
	} | null>(null)
	const query = serializarFiltros(selecao)
	const chave = `${tentativa}:${query}`

	useEffect(() => {
		const controller = new AbortController()
		setCarregandoCatalogo(true)
		setErroCatalogo('')
		consultarCatalogo(controller.signal)
			.then((dados) => {
				if (controller.signal.aborted) return
				setCatalogo(dados)
			})
			.catch(() => {
				if (!controller.signal.aborted)
					setErroCatalogo('Não foi possível carregar as opções de filtros.')
			})
			.finally(() => {
				if (!controller.signal.aborted) setCarregandoCatalogo(false)
			})
		return () => controller.abort()
	}, [tentativa])

	useEffect(() => {
		gravarUrl(Object.keys(limparFiltros()), Object.entries(selecao))
	}, [selecao])

	useEffect(() => {
		if (!catalogo) return
		const proximo = atualizarSelecao(selecao, catalogo)
		if (serializarFiltros(proximo) !== query) {
			setAvisoSelecao(
				selecao.ano
					? 'Algumas seleções não estão mais disponíveis e foram ajustadas ao catálogo atual.'
					: ''
			)
			// Ano ausente ou fora do catálogo (link antigo): volta a escolher o
			// ano mais recente com dados.
			if (proximo.ano !== selecao.ano) setAnoAutomatico(true)
			setSelecao(proximo)
		}
	}, [catalogo, selecao, query])

	useEffect(() => {
		if (!selecao.ano || carregandoCatalogo || erroCatalogo) return
		const controller = new AbortController()
		consultarResumo(query, controller.signal)
			.then((dados) => {
				if (!controller.signal.aborted) setResposta({ chave, dados })
			})
			.catch(() => {
				if (!controller.signal.aborted)
					setResposta({
						chave,
						erro: 'Não foi possível carregar o resumo deste recorte.'
					})
			})
		return () => controller.abort()
	}, [query, chave, selecao.ano, carregandoCatalogo, erroCatalogo])

	const atual = resposta?.chave === chave ? resposta : null
	const carregando =
		carregandoCatalogo || (!erroCatalogo && !!selecao.ano && !atual)
	const erro = erroCatalogo || atual?.erro
	const resumo = atual?.dados
	const filtrosAtivos = camposFiltro.some((campo) => selecao[campo.chave])
	const indiceAno = catalogo?.anos.indexOf(Number(selecao.ano)) ?? -1
	const anoAnterior = indiceAno >= 0 ? catalogo?.anos[indiceAno + 1] : undefined

	useEffect(() => {
		if (!anoAutomatico || filtrosAtivos || !resumo?.qualidade.sem_dados) return
		if (anoAnterior === undefined) return
		setAnosPulados((lista) => [...lista, selecao.ano])
		setSelecao((atual) => ({ ...atual, ano: String(anoAnterior) }))
	}, [anoAutomatico, filtrosAtivos, resumo, anoAnterior, selecao.ano])

	function alterar(chaveFiltro: keyof SelecaoFiltros, valor: string) {
		setAvisoSelecao('')
		if (chaveFiltro === 'ano') setAnoAutomatico(false)
		setSelecao((atual) => ({ ...atual, [chaveFiltro]: valor }))
	}
	function limpar() {
		setAvisoSelecao('')
		setSelecao(limparFiltros(selecao.ano))
	}

	return (
		<>
			<FiltrosIndicadores
				catalogo={catalogo}
				selecao={selecao}
				carregando={carregandoCatalogo}
				indisponivel={!!erroCatalogo}
				onChange={alterar}
				onLimpar={limpar}
			/>
			{avisoSelecao && (
				<p className="filter-help" role="status">
					{avisoSelecao}
				</p>
			)}
			{anoAutomatico &&
				anosPulados.length > 0 &&
				resumo &&
				!resumo.qualidade.sem_dados && (
					<p className="filter-help" role="status">
						{anosPulados.join(', ')} ainda não{' '}
						{anosPulados.length === 1 ? 'tem' : 'têm'} dados de alunos. Exibindo{' '}
						{selecao.ano}, o ano mais recente com dados.
					</p>
				)}
			<section aria-labelledby="resumo-titulo" aria-busy={carregando}>
				<div className="section-heading">
					<h2 id="resumo-titulo">Resumo anual</h2>
					<div className="summary-controls">
						<div className="summary-year">
							<label className="form-label" htmlFor="ano">
								Ano do resumo
							</label>
							<select
								className="form-select"
								id="ano"
								name="ano"
								value={selecao.ano}
								disabled={
									carregandoCatalogo || !!erroCatalogo || !catalogo?.anos.length
								}
								onChange={(event) => alterar('ano', event.target.value)}
							>
								{!catalogo?.anos.length && (
									<option value="">
										{carregandoCatalogo
											? 'Carregando…'
											: 'Sem anos disponíveis'}
									</option>
								)}
								{catalogo?.anos.map((ano) => (
									<option key={ano} value={ano}>
										{ano}
									</option>
								))}
							</select>
						</div>
						<button
							className="btn btn-outline-success btn-sm"
							disabled={carregando}
							onClick={() => setTentativa((value) => value + 1)}
						>
							Atualizar dados
						</button>
					</div>
				</div>
				<div aria-live="polite">
					{carregando && <Carregando texto="Carregando indicadores…" />}
					{!carregando && erro && (
						<p className="state error" role="alert">
							{erro} Use “Atualizar dados” para tentar novamente.
						</p>
					)}
					{!carregando && !erro && !catalogo?.anos.length && (
						<p className="state">
							Nenhum ano está disponível na base conectada.
						</p>
					)}
					{!carregando && !erro && resumo?.qualidade.sem_dados && (
						<div className="state state-empty">
							<h3>Sem dados de alunos em {selecao.ano}</h3>
							<p>
								{filtrosAtivos
									? 'Esta combinação de filtros não tem registros de alunos no ano.'
									: 'A base não tem registros de alunos neste ano.'}
							</p>
							<div className="state-actions">
								{anoAnterior !== undefined && (
									<button
										className="btn btn-outline-success btn-sm"
										type="button"
										onClick={() => alterar('ano', String(anoAnterior))}
									>
										Ver {anoAnterior}
									</button>
								)}
								{filtrosAtivos && (
									<button
										className="btn btn-outline-success btn-sm"
										type="button"
										onClick={limpar}
									>
										Limpar filtros
									</button>
								)}
							</div>
						</div>
					)}
				</div>
				{!carregando && !erro && resumo && !resumo.qualidade.sem_dados && (
					<ResumoIndicadores resumo={resumo} />
				)}
			</section>
			<PainelEvolucao
				anos={catalogo?.anos ?? []}
				selecao={selecao}
				onAnoChange={(ano) => alterar('ano', ano)}
				atualizacao={tentativa}
				indisponivel={carregandoCatalogo || !!erroCatalogo}
			/>
			<PainelComparacoes
				catalogo={catalogo}
				selecao={selecao}
				atualizacao={tentativa}
				indisponivel={carregandoCatalogo || !!erroCatalogo}
				onAnoChange={(ano) => alterar('ano', ano)}
				onSelecaoChange={(proxima) => {
					setAvisoSelecao('')
					setSelecao(proxima)
				}}
			/>
		</>
	)
}
