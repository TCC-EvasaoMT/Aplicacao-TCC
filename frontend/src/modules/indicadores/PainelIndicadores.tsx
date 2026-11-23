import { useEffect, useState } from 'react'
import { PainelComparacoes, PainelEvolucao } from '../analises'
import { consultarCatalogo, type Catalogo } from '../catalogos'
import { consultarResumo, type Resumo } from './api'
import {
	atualizarSelecao,
	limparFiltros,
	serializarFiltros,
	type SelecaoFiltros
} from './filtros'
import { FiltrosIndicadores } from './FiltrosIndicadores'
import { ResumoIndicadores } from './ResumoIndicadores'

export function PainelIndicadores() {
	const [catalogo, setCatalogo] = useState<Catalogo | null>(null)
	const [selecao, setSelecao] = useState(limparFiltros)
	const [carregandoCatalogo, setCarregandoCatalogo] = useState(true)
	const [erroCatalogo, setErroCatalogo] = useState('')
	const [avisoSelecao, setAvisoSelecao] = useState('')
	const [tentativa, setTentativa] = useState(0)
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
		if (!catalogo) return
		const proximo = atualizarSelecao(selecao, catalogo)
		if (serializarFiltros(proximo) !== query) {
			setAvisoSelecao(
				selecao.ano
					? 'Algumas seleções não estão mais disponíveis e foram ajustadas ao catálogo atual.'
					: ''
			)
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
	function alterar(chaveFiltro: keyof SelecaoFiltros, valor: string) {
		setAvisoSelecao('')
		setSelecao((atual) => ({ ...atual, [chaveFiltro]: valor }))
	}

	return (
		<>
			<FiltrosIndicadores
				catalogo={catalogo}
				selecao={selecao}
				carregando={carregandoCatalogo}
				indisponivel={!!erroCatalogo}
				onChange={alterar}
				onLimpar={() => {
					setAvisoSelecao('')
					setSelecao(limparFiltros(selecao.ano))
				}}
			/>
			{avisoSelecao && (
				<p className="filter-help" role="status">
					{avisoSelecao}
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
					{carregando && <p className="state">Carregando indicadores…</p>}
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
						<p className="state">
							Não há dados de alunos para esta combinação de filtros em{' '}
							{selecao.ano}. Altere as seleções ou use “Limpar filtros”.
						</p>
					)}
				</div>
				{!carregando && !erro && resumo && !resumo.qualidade.sem_dados && (
					<ResumoIndicadores resumo={resumo} />
				)}
			</section>
			<PainelEvolucao
				anos={catalogo?.anos ?? []}
				selecao={selecao}
				atualizacao={tentativa}
				indisponivel={carregandoCatalogo || !!erroCatalogo}
			/>
			<PainelComparacoes
				catalogo={catalogo}
				selecao={selecao}
				atualizacao={tentativa}
				indisponivel={carregandoCatalogo || !!erroCatalogo}
				onAnoChange={(ano) => alterar('ano', ano)}
			/>
		</>
	)
}
