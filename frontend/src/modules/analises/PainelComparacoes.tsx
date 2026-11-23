import { lazy, Suspense, useEffect, useState } from 'react'
import { Carregando, GraficoCarregando } from '../../lib/Estados'
import { LimiteErro } from '../../lib/LimiteErro'
import { plural } from './apresentacao'
import type { Catalogo } from '../catalogos'
import type { SelecaoFiltros } from '../indicadores'
import { consultarComparacao, type Comparacao } from './api'
import { gravarUrl, lerUrl } from '../../lib/url'
import {
	alternarFiltroGrupo,
	comparacaoPadrao,
	dimensoesComparacao,
	grupoEmDestaque,
	gruposAusentes,
	lerComparacao,
	opcoesComparacao,
	serializarComparacao,
	type DimensaoComparacao
} from './comparacoes'
import { SeletorGrupos } from './SeletorGrupos'

// Recharts fica em um chunk separado; o download começa junto com a consulta.
const carregarGrafico = () => import('./GraficoComparacoes')
const GraficoComparacoes = lazy(() =>
	carregarGrafico().then((modulo) => ({ default: modulo.GraficoComparacoes }))
)

interface Props {
	catalogo: Catalogo | null
	selecao: SelecaoFiltros
	atualizacao: number
	indisponivel: boolean
	onAnoChange: (ano: string) => void
	onSelecaoChange: (selecao: SelecaoFiltros) => void
}

// Repete "grupos" como lista; o limite é detalhe da consulta, não do recorte.
function parametrosCsv(query: string) {
	const parametros = new URLSearchParams(query)
	const grupos = parametros.getAll('grupos').join(', ')
	parametros.delete('grupos')
	parametros.delete('limite')
	return {
		...Object.fromEntries(parametros),
		...(grupos ? { grupos } : {})
	}
}

export function PainelComparacoes({
	catalogo,
	selecao,
	atualizacao,
	indisponivel,
	onAnoChange,
	onSelecaoChange
}: Props) {
	const [aplicado, setAplicado] = useState(() => lerComparacao(lerUrl()))
	const [rascunho, setRascunho] = useState(aplicado)
	const [tentativa, setTentativa] = useState(0)
	const [resposta, setResposta] = useState<{
		chave: string
		dados?: Comparacao
		erro?: string
	} | null>(null)
	const query = serializarComparacao(aplicado, selecao)
	const chave = `${atualizacao}:${tentativa}:${query}`
	const podeConsultar =
		!indisponivel && !!catalogo?.anos.includes(Number(selecao.ano))
	const pendente = serializarComparacao(rascunho, selecao) !== query
	const dimensao = dimensoesComparacao[aplicado.agrupar_por]
	const opcoes = opcoesComparacao(catalogo, rascunho.agrupar_por)
	const atual = resposta?.chave === chave ? resposta : null
	const dados = podeConsultar ? atual?.dados : undefined
	const carregando = podeConsultar && !atual
	const ausentes = dados ? gruposAusentes(aplicado.grupos, dados.grupos) : []
	const destaque = grupoEmDestaque(aplicado.agrupar_por, selecao)
	const rotuloDestaque =
		opcoesComparacao(catalogo, aplicado.agrupar_por).find(
			(opcao) => opcao.valor === destaque
		)?.rotulo ?? destaque
	const destaqueAusente =
		!!destaque &&
		!!dados &&
		!dados.grupos.some(({ grupo }) => grupo.valor === destaque)

	useEffect(() => {
		carregarGrafico().catch(() => {})
	}, [])

	useEffect(() => {
		const padrao =
			aplicado.agrupar_por === comparacaoPadrao.agrupar_por &&
			!aplicado.grupos.length
		gravarUrl(
			['agrupar_por', 'grupos'],
			padrao
				? []
				: [
						['agrupar_por', aplicado.agrupar_por],
						...aplicado.grupos.map((grupo) => ['grupos', grupo] as const)
					]
		)
	}, [aplicado])

	useEffect(() => {
		if (!podeConsultar) return
		const controller = new AbortController()
		setResposta(null)
		consultarComparacao(query, controller.signal)
			.then((dados) => {
				if (!controller.signal.aborted) setResposta({ chave, dados })
			})
			.catch(() => {
				if (!controller.signal.aborted)
					setResposta({
						chave,
						erro: 'Não foi possível carregar a comparação.'
					})
			})
		return () => controller.abort()
	}, [query, chave, podeConsultar])

	return (
		<section
			className="comparison"
			aria-labelledby="comparacao-titulo"
			aria-busy={carregando}
		>
			<div className="section-heading">
				<h2 id="comparacao-titulo">Comparação entre grupos</h2>
				<div className="summary-year">
					<label className="form-label" htmlFor="comparacao-ano">
						Ano da comparação
					</label>
					<select
						className="form-select"
						id="comparacao-ano"
						value={selecao.ano}
						disabled={!podeConsultar}
						aria-describedby="comparacao-contexto"
						onChange={(event) => onAnoChange(event.target.value)}
					>
						{!catalogo?.anos.length && (
							<option value="">Sem anos disponíveis</option>
						)}
						{catalogo?.anos.map((ano) => (
							<option key={ano} value={ano}>
								{ano}
							</option>
						))}
					</select>
				</div>
			</div>
			<p className="filter-help" id="comparacao-contexto">
				Compare grupos no mesmo ano e recorte. O ano é compartilhado com o
				resumo; os filtros do painel também se aplicam aqui.
			</p>
			<form
				onSubmit={(event) => {
					event.preventDefault()
					setAplicado({ ...rascunho, grupos: [...rascunho.grupos] })
				}}
			>
				<fieldset disabled={!podeConsultar}>
					<legend className="visually-hidden">Configurar comparação</legend>
					<div className="comparison-dimension">
						<label className="form-label" htmlFor="comparacao-dimensao">
							Agrupar por
						</label>
						<select
							className="form-select"
							id="comparacao-dimensao"
							value={rascunho.agrupar_por}
							onChange={(event) =>
								setRascunho({
									agrupar_por: event.target.value as DimensaoComparacao,
									grupos: []
								})
							}
						>
							{Object.entries(dimensoesComparacao).map(
								([valor, { rotulo }]) => (
									<option key={valor} value={valor}>
										{rotulo}
									</option>
								)
							)}
						</select>
					</div>
					<SeletorGrupos
						key={rascunho.agrupar_por}
						opcoes={opcoes}
						grupos={rascunho.grupos}
						onChange={(grupos) => setRascunho({ ...rascunho, grupos })}
					/>
					<button className="btn btn-success" type="submit">
						Comparar grupos
					</button>
				</fieldset>
			</form>
			{pendente && (
				<p className="filter-help" role="status">
					Há alterações de agrupamento ou seleção. Use “Comparar grupos” para
					aplicá-las.
				</p>
			)}
			<div aria-live="polite">
				{!podeConsultar && (
					<p className="state">
						Aguardando anos e filtros disponíveis. Em caso de falha, use
						“Atualizar dados” no resumo.
					</p>
				)}
				{carregando && <Carregando texto="Carregando comparação…" />}
				{podeConsultar && atual?.erro && (
					<div className="alert alert-danger" role="alert">
						<p>{atual.erro}</p>
						<button
							className="btn btn-outline-success btn-sm"
							onClick={() => setTentativa((valor) => valor + 1)}
						>
							Tentar comparação novamente
						</button>
					</div>
				)}
				{dados && (
					<>
						<h3 className="comparison-result">
							{dimensao.rotulo} em {selecao.ano}:{' '}
							{dados.grupos.length === dados.total_grupos
								? plural(dados.total_grupos, 'grupo', 'grupos')
								: `${dados.grupos.length} de ${plural(dados.total_grupos, 'grupo', 'grupos')}`}
						</h3>
						<p className="filter-help">
							Ordem por código ou atributo, sem ranking de evasão.
						</p>
						{destaque && (
							<p className="filter-help">
								{dimensao.rotulo} {rotuloDestaque} em destaque. Os demais grupos
								seguem visíveis para comparar; resumo e evolução mostram só esse
								grupo.
							</p>
						)}
						{destaqueAusente && (
							<p className="quality">
								{rotuloDestaque} não aparece nesta comparação: não tem registros
								neste ano e recorte ou ficou fora dos grupos exibidos.
							</p>
						)}
						{dados.truncado && (
							<p className="quality">
								Exibindo somente {dados.grupos.length} de {dados.total_grupos}{' '}
								grupos. Selecione até 20 grupos ou refine os filtros para
								comparar os demais.
							</p>
						)}
						{ausentes.length > 0 && (
							<p className="quality">
								Sem correspondência neste ano e recorte: {ausentes.join(', ')}.
								Esses grupos não recebem valores zero.
							</p>
						)}
						{dados.grupos.length === 0 && (
							<p className="state">
								Nenhum grupo corresponde à seleção neste ano e recorte. Altere
								os filtros, o ano ou a seleção de grupos.
							</p>
						)}
					</>
				)}
			</div>
			{dados && dados.grupos.length > 0 && (
				<LimiteErro mensagem="Não foi possível exibir o gráfico da comparação.">
					<Suspense fallback={<GraficoCarregando />}>
						<GraficoComparacoes
							grupos={dados.grupos}
							parametros={parametrosCsv(query)}
							destaque={destaque}
							onSelecionar={(valor) =>
								onSelecaoChange(
									alternarFiltroGrupo(selecao, aplicado.agrupar_por, valor)
								)
							}
						/>
					</Suspense>
				</LimiteErro>
			)}
			<p className="filter-help">
				Características institucionais podem reunir várias IES. Municípios de
				oferta e sede são dimensões distintas, inclusive nos cursos a distância.
			</p>
		</section>
	)
}
