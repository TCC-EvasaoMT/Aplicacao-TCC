import { useEffect, useState } from 'react'
import { Button } from 'primereact/button'
import { Message } from 'primereact/message'
import { Carregando } from '../../lib/Estados'
import { mensagemErro } from '../../lib/http'
import { CampoLista } from '../../lib/CampoLista'
import { Ajuda, classes, cx } from '../../lib/ui'
import { gravarUrl, lerUrl } from '../../lib/url'
import type { Catalogo } from '../catalogos'
import type { SelecaoFiltros } from '../indicadores'
import {
	consultarRanking,
	type DimensaoRanking,
	type Ranking,
	type TaxaDispersao
} from './api'
import { avisosDoRecorte, formatarTaxa, plural } from './apresentacao'
import {
	CelulaNumero,
	classesLinha,
	classesLinkFiltro,
	classesTabela,
	classesTabelaCompacta,
	ListaAvisos,
	NotaTabela,
	Tabela
} from './Celulas'
import { alternarFiltroGrupo } from './comparacoes'
import { csvRanking, descreverRecorte } from './exportacao'
import {
	categoriasSemRegistro,
	larguraBarra,
	lerTaxaRanking,
	rankings,
	rotuloCategoria,
	motivosSemPosicao,
	rotuloPosicao,
	serializarRanking,
	taxasRanking
} from './ranking'

interface Props {
	catalogo: Catalogo | null
	selecao: SelecaoFiltros
	atualizacao: number
	indisponivel: boolean
	onSelecaoChange: (selecao: SelecaoFiltros) => void
}

// Consulta de um ranking, cancelável; mantém o último resultado na tela,
// esmaecido, enquanto o próximo carrega.
function useRanking(query: string, chave: string, podeConsultar: boolean) {
	const [resposta, setResposta] = useState<{
		chave: string
		dados?: Ranking
		erro?: string
	} | null>(null)
	const [ultimo, setUltimo] = useState<{
		dados: Ranking
		query: string
	} | null>(null)
	useEffect(() => {
		if (!podeConsultar) return
		const controller = new AbortController()
		consultarRanking(query, controller.signal)
			.then((dados) => {
				if (controller.signal.aborted) return
				setResposta({ chave, dados })
				setUltimo({ dados, query })
			})
			.catch((falha) => {
				if (!controller.signal.aborted)
					setResposta({
						chave,
						erro: mensagemErro(falha, 'Não foi possível carregar o ranking.')
					})
			})
		return () => controller.abort()
	}, [query, chave, podeConsultar])
	const atual = resposta?.chave === chave ? resposta : null
	return {
		carregando: podeConsultar && !atual,
		erro: atual?.erro,
		exibido: atual?.dados ? { dados: atual.dados, query } : ultimo,
		atualizando: podeConsultar && !atual && !!ultimo
	}
}

function TabelaRanking({
	titulo,
	dimensao,
	taxa,
	ano,
	catalogo,
	selecao,
	atualizacao,
	podeConsultar,
	onSelecaoChange
}: {
	titulo: string
	dimensao: DimensaoRanking
	taxa: TaxaDispersao
	ano: string
	catalogo: Catalogo | null
	selecao: SelecaoFiltros
	atualizacao: number
	podeConsultar: boolean
	onSelecaoChange: (selecao: SelecaoFiltros) => void
}) {
	const [tentativa, setTentativa] = useState(0)
	const query = serializarRanking(selecao, dimensao, taxa)
	const { carregando, erro, exibido, atualizando } = useRanking(
		query,
		`${atualizacao}:${tentativa}:${query}`,
		podeConsultar
	)
	const filtro = rankings.find((r) => r.dimensao === dimensao)!.filtro
	const destaque = selecao[filtro]
	const dados = exibido?.dados
	const semRegistro = dados
		? categoriasSemRegistro(catalogo, dimensao, dados.grupos)
		: []
	const maior = Math.max(
		0,
		...(dados?.grupos ?? [])
			.filter((g) => g.posicao !== null)
			.map((g) => g.taxas[taxa] ?? 0)
	)
	const corBarra =
		taxa === 'evasao_curso' ? 'bg-panel-green' : 'bg-panel-secondary'
	return (
		<div className="min-w-0" aria-busy={carregando}>
			<h3 className="mb-2">{titulo}</h3>
			{carregando && !exibido && <Carregando texto="Carregando ranking…" />}
			{!carregando && erro && (
				<Message
					severity="error"
					content={
						<>
							<p className="mb-3">{erro}</p>
							<Button
								label="Tentar ranking novamente"
								outlined
								size="small"
								onClick={() => setTentativa((valor) => valor + 1)}
							/>
						</>
					}
				/>
			)}
			{dados && (
				<div className={cx(atualizando && classes.atualizando)}>
					<Ajuda className="mt-0">
						{plural(
							dados.grupos.length + semRegistro.length,
							'categoria',
							'categorias'
						)}{' '}
						em {ano},{' '}
						{plural(dados.classificados, 'classificada', 'classificadas')}.
					</Ajuda>
					<Tabela
						rotulo={`Ranking de ${titulo.toLowerCase()}`}
						legenda={`${titulo} por ${taxasRanking.find((t) => t.valor === taxa)!.rotulo.toLowerCase()}, da maior para a menor`}
					>
						<thead>
							<tr>
								<th
									scope="col"
									className={cx(classesTabelaCompacta.cabecalho, 'w-px')}
								>
									Posição
								</th>
								<th
									scope="col"
									className={cx(
										classesTabelaCompacta.cabecalho,
										'min-w-[140px]'
									)}
								>
									Categoria
								</th>
								<th scope="col" className={classesTabela.cabecalhoNumero}>
									Taxa
								</th>
								<th
									scope="col"
									className={classesTabelaCompacta.cabecalhoNumero}
								>
									Base de risco
								</th>
								<th scope="col" className={classesTabela.cabecalho}>
									Qualidade
								</th>
							</tr>
						</thead>
						<tbody>
							{dados.grupos.map((grupo) => {
								const valor = grupo.grupo.valor
								const rotulo = rotuloCategoria(grupo.grupo)
								const selecionado = valor !== null && valor === destaque
								const taxaGrupo = grupo.taxas[taxa]
								return (
									<tr
										key={valor ?? '__sem_identificador__'}
										className={classesLinha(selecionado, false)}
									>
										<td
											className={cx(
												classesTabelaCompacta.texto,
												'w-px whitespace-nowrap',
												grupo.posicao === null
													? 'text-panel-muted'
													: 'font-semibold'
											)}
										>
											{rotuloPosicao(grupo)}
											{grupo.posicao === null && (
												<span className="sr-only">Sem posição</span>
											)}
										</td>
										<th
											scope="row"
											className={cx(
												classesTabelaCompacta.linhaCabecalho,
												'min-w-[140px] max-w-[240px] wrap-anywhere'
											)}
										>
											{valor === null ? (
												rotulo
											) : (
												<button
													type="button"
													className={classesLinkFiltro}
													aria-pressed={selecionado}
													aria-label={`Filtrar por ${rotulo}`}
													onClick={() =>
														onSelecaoChange(
															alternarFiltroGrupo(selecao, dimensao, valor)
														)
													}
												>
													{rotulo}
												</button>
											)}
										</th>
										<td className={classesTabela.numero}>
											<div className="flex items-center justify-end gap-2">
												<span
													className="hidden h-2 w-12 overflow-hidden rounded-full bg-panel-chip sm:block"
													aria-hidden="true"
												>
													<span
														className={cx(
															'block h-full rounded-full',
															corBarra
														)}
														style={{
															width: `${larguraBarra(grupo, taxa, maior)}%`
														}}
													/>
												</span>
												{taxaGrupo === null ? (
													<>
														<span aria-hidden="true">...</span>
														<span className="sr-only">Não disponível</span>
													</>
												) : (
													formatarTaxa(taxaGrupo)
												)}
											</div>
										</td>
										<CelulaNumero valor={grupo.base_risco} compacta />
										<td className={classesTabela.texto}>
											<ListaAvisos
												avisos={[
													...(grupo.posicao === null
														? [motivosSemPosicao[grupo.situacao]]
														: []),
													...avisosDoRecorte(grupo)
												]}
											/>
										</td>
									</tr>
								)
							})}
							{semRegistro.map((rotulo) => (
								<tr key={`sem-registro-${rotulo}`}>
									<td
										className={cx(
											classesTabelaCompacta.texto,
											'w-px whitespace-nowrap text-panel-muted'
										)}
									>
										Sem registros
									</td>
									<th
										scope="row"
										className={cx(
											classesTabelaCompacta.linhaCabecalho,
											'min-w-[140px] font-normal text-panel-muted'
										)}
									>
										{rotulo}
									</th>
									<td
										className={cx(classesTabela.texto, 'text-panel-muted')}
										colSpan={3}
									>
										Sem registros neste ano e recorte
									</td>
								</tr>
							))}
						</tbody>
					</Tabela>
					<NotaTabela
						exportar={{
							arquivo: `evasao-mt-ranking-${dimensao}-${ano}.csv`,
							rotulo: `Baixar CSV do ranking de ${titulo.toLowerCase()}`,
							gerar: () =>
								csvRanking(
									dados.grupos,
									descreverRecorte(
										Object.fromEntries(new URLSearchParams(exibido!.query))
									)
								)
						}}
					/>
				</div>
			)}
		</div>
	)
}

export function PainelRanking({
	catalogo,
	selecao,
	atualizacao,
	indisponivel,
	onSelecaoChange
}: Props) {
	const [taxa, setTaxa] = useState<TaxaDispersao>(() =>
		lerTaxaRanking(lerUrl())
	)
	const podeConsultar =
		!indisponivel && !!catalogo?.anos.includes(Number(selecao.ano))

	useEffect(() => {
		gravarUrl(
			['taxa_ranking'],
			taxa === taxasRanking[0]!.valor ? [] : [['taxa_ranking', taxa]]
		)
	}, [taxa])

	return (
		<section
			className={cx(classes.secao, 'mb-6')}
			aria-labelledby="ranking-titulo"
		>
			<div className={classes.cabecalhoSecao}>
				<h2 id="ranking-titulo" className={classes.titulo}>
					Ranking de áreas e modalidades
				</h2>
				<div className="min-w-56">
					<label className={classes.rotulo} htmlFor="ranking-taxa">
						Ordenar por
					</label>
					<CampoLista
						inputId="ranking-taxa"
						value={taxa}
						options={taxasRanking.map(({ valor, rotulo }) => ({
							value: valor,
							label: rotulo
						}))}
						onChange={(valor) => setTaxa(valor as TaxaDispersao)}
					/>
				</div>
			</div>
			<Ajuda>
				Todas as áreas gerais CINE e modalidades de {selecao.ano || '…'}, da
				maior para a menor taxa. Taxas iguais dividem a posição (1º, 2º, 2º,
				4º). Grupos com base de risco abaixo de 30, sem taxa ou sem
				identificador aparecem no fim, sem posição. Os filtros do painel se
				aplicam, exceto o da própria dimensão, que destaca a categoria.
			</Ajuda>
			{!podeConsultar ? (
				<p className={cx(classes.estado, 'mt-4')}>
					Aguardando anos e filtros disponíveis. Em caso de falha, use
					“Atualizar dados” no resumo.
				</p>
			) : (
				<div className="mt-4 grid gap-6 min-[1400px]:grid-cols-2">
					{rankings.map(({ dimensao, titulo }) => (
						<TabelaRanking
							key={dimensao}
							titulo={titulo}
							dimensao={dimensao}
							taxa={taxa}
							ano={selecao.ano}
							catalogo={catalogo}
							selecao={selecao}
							atualizacao={atualizacao}
							podeConsultar={podeConsultar}
							onSelecaoChange={onSelecaoChange}
						/>
					))}
				</div>
			)}
		</section>
	)
}
