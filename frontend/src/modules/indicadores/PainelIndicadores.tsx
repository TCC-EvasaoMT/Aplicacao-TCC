import { useEffect, useState } from 'react'
import { Button } from 'primereact/button'
import { Message } from 'primereact/message'
import {
	PainelComparacoes,
	PainelDispersao,
	PainelEvolucao,
	PainelRanking
} from '../analises'
import { Carregando } from '../../lib/Estados'
import { empilhar, exibicao } from '../../lib/exibicao'
import { mensagemErro } from '../../lib/http'
import { CampoLista } from '../../lib/CampoLista'
import { Ajuda, classes, cx } from '../../lib/ui'
import { gravarUrl, lerUrl } from '../../lib/url'
import { consultarCatalogo, type Catalogo } from '../catalogos'
import type { AbaPainel } from './abas'
import { consultarResumo, type Resumo } from './api'
import { ChipsFiltros } from './ChipsFiltros'
import {
	anuncioMudanca,
	atualizarSelecao,
	filtrosAtivos as listarFiltrosAtivos,
	lerSelecao,
	limparFiltros,
	serializarFiltros,
	type CampoFiltro,
	type SelecaoFiltros
} from './filtros'
import { FiltrosIndicadores } from './FiltrosIndicadores'
import { ResumoIndicadores } from './ResumoIndicadores'

// Cada registro da fato de curso é um curso no ano.
function cursosNoCalculo(quantidade: number, ano: string) {
	const numero = quantidade.toLocaleString('pt-BR')
	return quantidade === 1
		? `1 curso com alunos entra no cálculo de ${ano}.`
		: `${numero} cursos com alunos entram no cálculo de ${ano}.`
}

export function PainelIndicadores({ aba }: { aba: AbaPainel }) {
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
	// Mesmo recorte no ano anterior, para a variação; null se falhou.
	const [respostaAnterior, setRespostaAnterior] = useState<{
		chave: string
		dados: Resumo | null
	} | null>(null)
	// Anúncio para leitores de tela, só para mudanças feitas pela pessoa.
	const [anuncio, setAnuncio] = useState('')
	// Último resumo exibido: fica na tela, esmaecido, enquanto o próximo carrega.
	const [ultimo, setUltimo] = useState<{
		dados: Resumo
		anterior: Resumo | null | undefined
		ano: string
	} | null>(null)
	// Mudanças feitas pela pessoa, para desfazer a última.
	const [historico, setHistorico] = useState<SelecaoFiltros[]>([])
	const [filtrosAbertos, setFiltrosAbertos] = useState(false)
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
			.catch((falha) => {
				if (!controller.signal.aborted)
					setResposta({
						chave,
						erro: mensagemErro(
							falha,
							'Não foi possível carregar o resumo deste recorte.'
						)
					})
			})
		return () => controller.abort()
	}, [query, chave, selecao.ano, carregandoCatalogo, erroCatalogo])

	// O ano anterior só é consultado se estiver no catálogo; fora dele não há
	// o que comparar, e a chamada a mais pesaria no limite de consultas da API.
	const anoAnteriorCalendario = Number(selecao.ano) - 1
	const queryAnterior = catalogo?.anos.includes(anoAnteriorCalendario)
		? serializarFiltros({ ...selecao, ano: String(anoAnteriorCalendario) })
		: ''
	const chaveAnterior = `${tentativa}:${queryAnterior}`
	useEffect(() => {
		if (!queryAnterior || carregandoCatalogo || erroCatalogo) return
		const controller = new AbortController()
		// A variação é complementar: chega depois do resumo e, se falhar, os
		// cartões mostram "sem comparação".
		consultarResumo(queryAnterior, controller.signal)
			.then((dados) => {
				if (!controller.signal.aborted)
					setRespostaAnterior({ chave: chaveAnterior, dados })
			})
			.catch(() => {
				if (!controller.signal.aborted)
					setRespostaAnterior({ chave: chaveAnterior, dados: null })
			})
		return () => controller.abort()
	}, [queryAnterior, chaveAnterior, carregandoCatalogo, erroCatalogo])
	const anterior: Resumo | null | undefined = !queryAnterior
		? null
		: respostaAnterior?.chave === chaveAnterior
			? respostaAnterior.dados
			: undefined

	const atual = resposta?.chave === chave ? resposta : null
	const carregando =
		carregandoCatalogo || (!erroCatalogo && !!selecao.ano && !atual)
	const erro = erroCatalogo || atual?.erro
	const resumo = atual?.dados
	const ativos = listarFiltrosAtivos(selecao, catalogo)
	const filtrosAtivos = ativos.length > 0
	useEffect(() => {
		if (resumo) setUltimo({ dados: resumo, anterior, ano: selecao.ano })
	}, [resumo, anterior, selecao.ano])
	// Durante a recarga, o último resumo com dados continua visível e
	// esmaecido; um resumo sem dados não é reaproveitado.
	const vista = exibicao(
		resumo ? { dados: resumo, anterior, ano: selecao.ano } : undefined,
		ultimo,
		carregando && !carregandoCatalogo && !erro,
		(dado) => !dado.dados.qualidade.sem_dados
	)
	const indiceAno = catalogo?.anos.indexOf(Number(selecao.ano)) ?? -1
	const anoAnterior = indiceAno >= 0 ? catalogo?.anos[indiceAno + 1] : undefined

	useEffect(() => {
		if (!anoAutomatico || filtrosAtivos || !resumo?.qualidade.sem_dados) return
		if (anoAnterior === undefined) return
		setAnosPulados((lista) => [...lista, selecao.ano])
		setSelecao((atual) => ({ ...atual, ano: String(anoAnterior) }))
	}, [anoAutomatico, filtrosAtivos, resumo, anoAnterior, selecao.ano])

	function aplicar(proxima: SelecaoFiltros) {
		if (serializarFiltros(proxima) === query) return
		setAvisoSelecao('')
		if (proxima.ano !== selecao.ano) setAnoAutomatico(false)
		setHistorico((lista) => empilhar(lista, selecao))
		setAnuncio(anuncioMudanca(selecao, proxima, catalogo))
		setSelecao(proxima)
	}
	function alterar(chaveFiltro: keyof SelecaoFiltros, valor: string) {
		aplicar({ ...selecao, [chaveFiltro]: valor })
	}
	function limpar() {
		aplicar(limparFiltros(selecao.ano))
	}
	function desfazer() {
		const anterior = historico.at(-1)
		if (!anterior) return
		setAvisoSelecao('')
		setAnoAutomatico(false)
		setHistorico((lista) => lista.slice(0, -1))
		setAnuncio(anuncioMudanca(selecao, anterior, catalogo))
		setSelecao(anterior)
	}

	return (
		<>
			<FiltrosIndicadores
				catalogo={catalogo}
				selecao={selecao}
				carregando={carregandoCatalogo}
				indisponivel={!!erroCatalogo}
				aberto={filtrosAbertos}
				onFechar={() => setFiltrosAbertos(false)}
				onChange={alterar}
				onLimpar={limpar}
			/>
			<ChipsFiltros
				ano={selecao.ano}
				ativos={ativos}
				resumo={vista.dado?.dados}
				anuncio={anuncio}
				filtrosAbertos={filtrosAbertos}
				onAbrirFiltros={() => setFiltrosAbertos(true)}
				onRemover={(chave: CampoFiltro) => alterar(chave, '')}
				onLimpar={limpar}
			/>
			{avisoSelecao && <Ajuda role="status">{avisoSelecao}</Ajuda>}
			{anoAutomatico &&
				anosPulados.length > 0 &&
				resumo &&
				!resumo.qualidade.sem_dados && (
					<Ajuda role="status">
						{anosPulados.join(', ')} ainda não{' '}
						{anosPulados.length === 1 ? 'tem' : 'têm'} dados de alunos. Exibindo{' '}
						{selecao.ano}, o ano mais recente com dados.
					</Ajuda>
				)}
			<div
				role="tabpanel"
				id="painel-resumo"
				aria-labelledby="aba-resumo"
				hidden={aba !== 'resumo'}
			>
				<section aria-labelledby="resumo-titulo" aria-busy={carregando}>
					<div className={classes.cabecalhoSecao}>
						<h2 id="resumo-titulo" className={classes.titulo}>
							Resumo anual
						</h2>
						<div className="flex flex-wrap items-end gap-4">
							<div className={classes.campoAno}>
								<label className={classes.rotulo} htmlFor="ano">
									Ano do resumo
								</label>
								<CampoLista
									inputId="ano"
									className="max-w-[260px]"
									value={selecao.ano}
									options={
										catalogo?.anos.length
											? catalogo.anos.map((ano) => ({
													value: String(ano),
													label: String(ano)
												}))
											: [
													{
														value: '',
														label: carregandoCatalogo
															? 'Carregando…'
															: 'Sem anos disponíveis'
													}
												]
									}
									disabled={
										carregandoCatalogo ||
										!!erroCatalogo ||
										!catalogo?.anos.length
									}
									onChange={(valor) => alterar('ano', valor)}
								/>
							</div>
							<Button
								label="Atualizar dados"
								outlined
								size="small"
								disabled={carregando}
								onClick={() => setTentativa((value) => value + 1)}
							/>
						</div>
					</div>
					{!erro && vista.dado && !vista.dado.dados.qualidade.sem_dados && (
						<Ajuda className={cx(vista.atualizando && classes.atualizando)}>
							{cursosNoCalculo(
								vista.dado.dados.qualidade.registros_com_alunos,
								vista.dado.ano
							)}{' '}
							Os valores são de um único ano do Censo; a aba Evolução mostra
							vários anos.
						</Ajuda>
					)}
					<div aria-live="polite">
						{carregando && !vista.atualizando && (
							<Carregando texto="Carregando indicadores…" />
						)}
						{!carregando && erro && (
							<Message
								severity="error"
								text={`${erro} Use “Atualizar dados” para tentar novamente.`}
							/>
						)}
						{!carregando && !erro && !catalogo?.anos.length && (
							<p className={classes.estado}>
								Nenhum ano está disponível na base conectada.
							</p>
						)}
						{!carregando && !erro && resumo?.qualidade.sem_dados && (
							<div className={classes.estadoVazio}>
								<h3 className="mb-1">Sem dados de alunos em {selecao.ano}</h3>
								<p className="mb-3 text-panel-muted">
									{filtrosAtivos
										? `Nenhum registro de alunos com ${ativos
												.map((filtro) => `${filtro.campo}: ${filtro.texto}`)
												.join(' e ')}.`
										: 'A base não tem registros de alunos neste ano.'}
								</p>
								<div className="flex flex-wrap gap-2">
									{historico.length > 0 && (
										<Button
											label="Desfazer última mudança"
											outlined
											size="small"
											onClick={desfazer}
										/>
									)}
									{anoAnterior !== undefined && (
										<Button
											label={`Ver ${anoAnterior}`}
											outlined
											size="small"
											onClick={() => alterar('ano', String(anoAnterior))}
										/>
									)}
									{filtrosAtivos && (
										<Button
											label="Limpar filtros"
											outlined
											size="small"
											onClick={limpar}
										/>
									)}
								</div>
							</div>
						)}
					</div>
					{!erro && vista.dado && !vista.dado.dados.qualidade.sem_dados && (
						<div
							className={cx(vista.atualizando && classes.atualizando)}
							aria-busy={vista.atualizando || undefined}
						>
							<ResumoIndicadores
								resumo={vista.dado.dados}
								anterior={vista.dado.anterior}
								ano={Number(vista.dado.ano)}
							/>
						</div>
					)}
				</section>
			</div>
			{/* Os painéis ficam montados: trocar de aba não refaz consultas
			    nem perde o rascunho da comparação. */}
			<div
				role="tabpanel"
				id="painel-evolucao"
				aria-labelledby="aba-evolucao"
				hidden={aba !== 'evolucao'}
			>
				<PainelEvolucao
					anos={catalogo?.anos ?? []}
					selecao={selecao}
					onAnoChange={(ano) => alterar('ano', ano)}
					atualizacao={tentativa}
					indisponivel={carregandoCatalogo || !!erroCatalogo}
				/>
			</div>
			<div
				role="tabpanel"
				id="painel-comparacao"
				aria-labelledby="aba-comparacao"
				hidden={aba !== 'comparacao'}
			>
				<PainelRanking
					catalogo={catalogo}
					selecao={selecao}
					atualizacao={tentativa}
					indisponivel={carregandoCatalogo || !!erroCatalogo}
					onSelecaoChange={aplicar}
				/>
				<PainelComparacoes
					catalogo={catalogo}
					selecao={selecao}
					atualizacao={tentativa}
					indisponivel={carregandoCatalogo || !!erroCatalogo}
					onAnoChange={(ano) => alterar('ano', ano)}
					onSelecaoChange={aplicar}
				/>
			</div>
			<div
				role="tabpanel"
				id="painel-dispersao"
				aria-labelledby="aba-dispersao"
				hidden={aba !== 'dispersao'}
			>
				<PainelDispersao
					catalogo={catalogo}
					selecao={selecao}
					atualizacao={tentativa}
					indisponivel={carregandoCatalogo || !!erroCatalogo}
					onAnoChange={(ano) => alterar('ano', ano)}
					onSelecaoChange={aplicar}
				/>
			</div>
		</>
	)
}
