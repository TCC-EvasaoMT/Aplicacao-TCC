import { lazy, Suspense, useEffect, useState } from 'react'
import { Button } from 'primereact/button'
import { Message } from 'primereact/message'
import { Carregando, GraficoCarregando } from '../../lib/Estados'
import { exibicao } from '../../lib/exibicao'
import { mensagemErro } from '../../lib/http'
import { LimiteErro } from '../../lib/LimiteErro'
import { CampoLista } from '../../lib/CampoLista'
import { Ajuda, Aviso, classes, cx } from '../../lib/ui'
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
	const [ultima, setUltima] = useState<{
		dados: Comparacao
		query: string
		agrupar_por: DimensaoComparacao
		grupos: string[]
		ano: string
	} | null>(null)
	const chave = `${atualizacao}:${tentativa}:${query}`
	const podeConsultar =
		!indisponivel && !!catalogo?.anos.includes(Number(selecao.ano))
	const pendente = serializarComparacao(rascunho, selecao) !== query
	const opcoes = opcoesComparacao(catalogo, rascunho.agrupar_por)
	const atual = resposta?.chave === chave ? resposta : null
	const carregando = podeConsultar && !atual
	// Enquanto o novo recorte carrega, a última comparação fica na tela,
	// esmaecida; rótulos e cliques seguem a dimensão dessa comparação.
	const vista = podeConsultar
		? exibicao(
				atual?.dados
					? {
							dados: atual.dados,
							query,
							agrupar_por: aplicado.agrupar_por,
							grupos: aplicado.grupos,
							ano: selecao.ano
						}
					: undefined,
				ultima,
				carregando
			)
		: { dado: null, atualizando: false }
	const exibida = vista.dado
	const atualizando = vista.atualizando
	const dados = exibida?.dados
	const dimensaoExibida = exibida?.agrupar_por ?? aplicado.agrupar_por
	const dimensao = dimensoesComparacao[dimensaoExibida]
	const ausentes =
		exibida && dados ? gruposAusentes(exibida.grupos, dados.grupos) : []
	const destaque = grupoEmDestaque(dimensaoExibida, selecao)
	const rotuloDestaque =
		opcoesComparacao(catalogo, dimensaoExibida).find(
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
				if (controller.signal.aborted) return
				setResposta({ chave, dados })
				setUltima({
					dados,
					query,
					agrupar_por: aplicado.agrupar_por,
					grupos: aplicado.grupos,
					ano: selecao.ano
				})
			})
			.catch((falha) => {
				if (!controller.signal.aborted)
					setResposta({
						chave,
						erro: mensagemErro(falha, 'Não foi possível carregar a comparação.')
					})
			})
		return () => controller.abort()
	}, [query, chave, podeConsultar])

	const opcoesAno = catalogo?.anos.length
		? catalogo.anos.map((ano) => ({ value: String(ano), label: String(ano) }))
		: [{ value: '', label: 'Sem anos disponíveis' }]
	const opcoesDimensao = Object.entries(dimensoesComparacao).map(
		([valor, { rotulo }]) => ({ value: valor, label: rotulo })
	)

	return (
		<section
			className={classes.secao}
			aria-labelledby="comparacao-titulo"
			aria-busy={carregando}
		>
			<div className={classes.cabecalhoSecao}>
				<h2 id="comparacao-titulo" className={classes.titulo}>
					Comparação entre grupos
				</h2>
				<div className={classes.campoAno}>
					<label className={classes.rotulo} htmlFor="comparacao-ano">
						Ano da comparação
					</label>
					<CampoLista
						inputId="comparacao-ano"
						className="max-w-[260px]"
						value={selecao.ano}
						options={opcoesAno}
						disabled={!podeConsultar}
						aria-describedby="comparacao-contexto"
						onChange={onAnoChange}
					/>
				</div>
			</div>
			<Ajuda id="comparacao-contexto">
				Compare grupos no mesmo ano e recorte. O ano é compartilhado com o
				resumo; os filtros do painel também se aplicam aqui.
			</Ajuda>
			<form
				className="mt-4"
				onSubmit={(event) => {
					event.preventDefault()
					setAplicado({ ...rascunho, grupos: [...rascunho.grupos] })
				}}
			>
				<fieldset disabled={!podeConsultar}>
					<legend className="sr-only">Configurar comparação</legend>
					<div className="flex flex-wrap items-end gap-3">
						<div className="w-full max-w-[360px]">
							<label className={classes.rotulo} htmlFor="comparacao-dimensao">
								Agrupar por
							</label>
							<CampoLista
								inputId="comparacao-dimensao"
								value={rascunho.agrupar_por}
								options={opcoesDimensao}
								disabled={!podeConsultar}
								onChange={(valor) =>
									setRascunho({
										agrupar_por: valor as DimensaoComparacao,
										grupos: []
									})
								}
							/>
						</div>
						<Button
							type="submit"
							label="Comparar grupos"
							disabled={!podeConsultar}
						/>
					</div>
					<SeletorGrupos
						key={rascunho.agrupar_por}
						opcoes={opcoes}
						grupos={rascunho.grupos}
						desabilitado={!podeConsultar}
						onChange={(grupos) => setRascunho({ ...rascunho, grupos })}
					/>
				</fieldset>
			</form>
			{pendente && (
				<Ajuda role="status">
					Há alterações de agrupamento ou seleção. Use “Comparar grupos” para
					aplicá-las.
				</Ajuda>
			)}
			<div aria-live="polite">
				{!podeConsultar && (
					<p className={cx(classes.estado, 'mt-4')}>
						Aguardando anos e filtros disponíveis. Em caso de falha, use
						“Atualizar dados” no resumo.
					</p>
				)}
				{carregando && !ultima && (
					<div className="mt-4">
						<Carregando texto="Carregando comparação…" />
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
									label="Tentar comparação novamente"
									outlined
									size="small"
									onClick={() => setTentativa((valor) => valor + 1)}
								/>
							</>
						}
					/>
				)}
				{exibida && dados && (
					<div
						className={cx(atualizando && classes.atualizando)}
						aria-busy={atualizando || undefined}
					>
						<h3 className="mt-6 mb-2">
							{dimensao.rotulo} em {exibida.ano}:{' '}
							{dados.grupos.length === dados.total_grupos
								? plural(dados.total_grupos, 'grupo', 'grupos')
								: `${dados.grupos.length} de ${plural(dados.total_grupos, 'grupo', 'grupos')}`}
						</h3>
						<Ajuda>Ordem por código ou atributo, sem ranking de evasão.</Ajuda>
						{destaque && (
							<Ajuda>
								{dimensao.rotulo} {rotuloDestaque} em destaque. Os demais grupos
								seguem visíveis para comparar; resumo e evolução mostram só esse
								grupo.
							</Ajuda>
						)}
						{destaqueAusente && (
							<Aviso>
								<p>
									{rotuloDestaque} não aparece nesta comparação: não tem
									registros neste ano e recorte ou ficou fora dos grupos
									exibidos.
								</p>
							</Aviso>
						)}
						{dados.truncado && (
							<Aviso>
								<p>
									Exibindo somente {dados.grupos.length} de {dados.total_grupos}{' '}
									grupos. Selecione até 20 grupos ou refine os filtros para
									comparar os demais.
								</p>
							</Aviso>
						)}
						{ausentes.length > 0 && (
							<Aviso>
								<p>
									Sem correspondência neste ano e recorte: {ausentes.join(', ')}
									. Esses grupos não recebem valores zero.
								</p>
							</Aviso>
						)}
						{dados.grupos.length === 0 && (
							<p className={cx(classes.estado, 'mt-4')}>
								Nenhum grupo corresponde à seleção neste ano e recorte. Altere
								os filtros, o ano ou a seleção de grupos.
							</p>
						)}
					</div>
				)}
			</div>
			{exibida && dados && dados.grupos.length > 0 && (
				<div
					className={cx(atualizando && classes.atualizando)}
					aria-busy={atualizando || undefined}
				>
					<LimiteErro mensagem="Não foi possível exibir o gráfico da comparação.">
						<Suspense fallback={<GraficoCarregando />}>
							<GraficoComparacoes
								grupos={dados.grupos}
								parametros={parametrosCsv(exibida.query)}
								destaque={destaque}
								onSelecionar={(valor) =>
									onSelecaoChange(
										alternarFiltroGrupo(selecao, dimensaoExibida, valor)
									)
								}
							/>
						</Suspense>
					</LimiteErro>
				</div>
			)}
			<Ajuda className="mt-6">
				Características institucionais podem reunir várias IES. Municípios de
				oferta e sede são dimensões distintas, inclusive nos cursos a distância.
			</Ajuda>
		</section>
	)
}
