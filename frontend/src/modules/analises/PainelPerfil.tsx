import { useEffect, useState } from 'react'
import { Button } from 'primereact/button'
import { Message } from 'primereact/message'
import { Carregando } from '../../lib/Estados'
import { mensagemErro } from '../../lib/http'
import { CampoLista } from '../../lib/CampoLista'
import { Ajuda, Aviso, classes, cx } from '../../lib/ui'
import { gravarUrl, lerUrl } from '../../lib/url'
import type { SelecaoFiltros } from '../indicadores'
import { consultarPerfil, type Perfil, type TaxaDispersao } from './api'
import { avisosDoRecorte, formatarTaxa, plural } from './apresentacao'
import {
	CelulaNumero,
	classesTabela,
	ListaAvisos,
	NotaTabela,
	Tabela
} from './Celulas'
import { csvPerfil, descreverRecorte } from './exportacao'
import {
	extremosPerfil,
	fatoresPerfil,
	larguraPerfil,
	lerFatorPerfil,
	lerTaxaPerfil,
	serializarPerfil,
	taxasPerfil
} from './perfil'

interface Props {
	selecao: SelecaoFiltros
	atualizacao: number
	podeConsultar: boolean
}

// Consulta cancelável; mantém o último resultado na tela, esmaecido,
// enquanto o próximo carrega.
function usePerfil(query: string, chave: string, podeConsultar: boolean) {
	const [resposta, setResposta] = useState<{
		chave: string
		dados?: Perfil
		erro?: string
	} | null>(null)
	const [ultimo, setUltimo] = useState<{ dados: Perfil; query: string } | null>(
		null
	)
	useEffect(() => {
		if (!podeConsultar) return
		const controller = new AbortController()
		consultarPerfil(query, controller.signal)
			.then((dados) => {
				if (controller.signal.aborted) return
				setResposta({ chave, dados })
				setUltimo({ dados, query })
			})
			.catch((falha) => {
				if (!controller.signal.aborted)
					setResposta({
						chave,
						erro: mensagemErro(falha, 'Não foi possível carregar o perfil.')
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

export function PainelPerfil({ selecao, atualizacao, podeConsultar }: Props) {
	const [fator, setFator] = useState(() => lerFatorPerfil(lerUrl()))
	const [taxa, setTaxa] = useState<TaxaDispersao>(() => lerTaxaPerfil(lerUrl()))
	const [tentativa, setTentativa] = useState(0)
	const query = serializarPerfil(selecao, fator)
	const { carregando, erro, exibido, atualizando } = usePerfil(
		query,
		`${atualizacao}:${tentativa}:${query}`,
		podeConsultar
	)

	useEffect(() => {
		const padraoFator = fator === fatoresPerfil[0]!.codigo
		const padraoTaxa = taxa === taxasPerfil[0]!.valor
		gravarUrl(
			['fator_perfil', 'taxa_perfil'],
			[
				...(padraoFator ? [] : [['fator_perfil', fator] as [string, string]]),
				...(padraoTaxa ? [] : [['taxa_perfil', taxa] as [string, string]])
			]
		)
	}, [fator, taxa])

	const dados = exibido?.dados
	const rotuloTaxa = taxasPerfil.find((t) => t.valor === taxa)!.rotulo
	const ressalva = fatoresPerfil.find(
		(f) => f.codigo === dados?.fator.codigo
	)?.ressalva
	const extremos = dados ? extremosPerfil(dados, taxa) : null
	const maior = Math.max(
		0,
		...(dados?.categorias ?? []).map((c) => c.taxas[taxa] ?? 0)
	)
	const semRegistros =
		!!dados && dados.categorias.every((c) => c.qualidade.sem_dados)
	const corBarra =
		taxa === 'evasao_curso' ? 'bg-panel-green' : 'bg-panel-secondary'

	return (
		<section
			className={cx(classes.secao, 'mt-6')}
			aria-labelledby="perfil-titulo"
			aria-busy={carregando}
		>
			<div className={classes.cabecalhoSecao}>
				<h2 id="perfil-titulo" className={classes.titulo}>
					Perfil de quem evade
				</h2>
				<div className="flex flex-wrap items-end gap-4">
					<div className="min-w-56">
						<label className={classes.rotulo} htmlFor="perfil-fator">
							Fator
						</label>
						<CampoLista
							inputId="perfil-fator"
							value={fator}
							options={fatoresPerfil.map(({ codigo, rotulo }) => ({
								value: codigo,
								label: rotulo
							}))}
							onChange={setFator}
						/>
					</div>
					<div className="min-w-48">
						<label className={classes.rotulo} htmlFor="perfil-taxa">
							Taxa
						</label>
						<CampoLista
							inputId="perfil-taxa"
							value={taxa}
							options={taxasPerfil.map(({ valor, rotulo }) => ({
								value: valor,
								label: rotulo
							}))}
							onChange={(valor) => setTaxa(valor as TaxaDispersao)}
						/>
					</div>
				</div>
			</div>
			<Ajuda>
				Taxas de evasão em cada categoria de um fator do perfil dos alunos, no
				ano e nos filtros do resumo. Mostram associação, não causa: a diferença
				entre categorias pode vir de outras características ligadas a elas. Cada
				fator é uma consulta própria ao SEDAP+, com ruído e grupos omitidos, por
				isso o total do fator pode diferir do resumo.
			</Ajuda>
			<div aria-live="polite">
				{!podeConsultar && (
					<p className={cx(classes.estado, 'mt-4')}>
						Aguardando anos e filtros disponíveis.
					</p>
				)}
				{carregando && !exibido && <Carregando texto="Carregando perfil…" />}
				{!carregando && erro && (
					<Message
						severity="error"
						content={
							<>
								<p className="mb-3">{erro}</p>
								<Button
									label="Tentar perfil novamente"
									outlined
									size="small"
									onClick={() => setTentativa((valor) => valor + 1)}
								/>
							</>
						}
					/>
				)}
			</div>
			{dados && (
				<div className={cx('mt-4', atualizando && classes.atualizando)}>
					{ressalva && (
						<Aviso className="mb-3">
							<p>{ressalva}</p>
						</Aviso>
					)}
					{dados.categorias.length === 0 ? (
						<p className={classes.estado}>
							Este fator ainda não está na base conectada.
						</p>
					) : semRegistros ? (
						<p className={classes.estado}>
							Sem registros de perfil para este fator em {selecao.ano} neste
							recorte.
						</p>
					) : (
						<>
							<Ajuda className="mt-0">
								{extremos
									? `${rotuloTaxa} maior entre “${extremos.maior.categoria.nome}” (${formatarTaxa(extremos.maior.taxas[taxa])}) e menor entre “${extremos.menor.categoria.nome}” (${formatarTaxa(extremos.menor.taxas[taxa])}), considerando ${plural(extremos.comparaveis, 'categoria', 'categorias')} com base de risco de pelo menos ${dados.base_minima}.`
									: `Não há duas categorias com ${rotuloTaxa.toLowerCase()} calculável e base de risco de pelo menos ${dados.base_minima} para comparar.`}
							</Ajuda>
							<Tabela
								rotulo={`Perfil: ${dados.fator.nome}`}
								legenda={`${rotuloTaxa} em cada categoria de “${dados.fator.nome}”, na ordem do catálogo`}
							>
								<thead>
									<tr>
										<th scope="col" className={classesTabela.cabecalho}>
											Categoria
										</th>
										<th scope="col" className={classesTabela.cabecalhoNumero}>
											{rotuloTaxa}
										</th>
										<th scope="col" className={classesTabela.cabecalhoNumero}>
											Base de risco
										</th>
										<th scope="col" className={classesTabela.cabecalho}>
											Qualidade
										</th>
									</tr>
								</thead>
								<tbody>
									{[
										...dados.categorias.map((c) => ({
											chave: `${c.categoria.codigo}`,
											nome: c.categoria.nome,
											item: c
										})),
										...(dados.conjunto
											? [
													{
														chave: '__conjunto__',
														nome: 'Todas as categorias',
														item: dados.conjunto
													}
												]
											: [])
									].map(({ chave, nome, item }) => {
										const conjunto = chave === '__conjunto__'
										const valor = item.taxas[taxa]
										return (
											<tr
												key={chave}
												className={cx(
													conjunto && 'border-t-2 border-panel-green'
												)}
											>
												<th
													scope="row"
													className={cx(
														classesTabela.linhaCabecalho,
														'min-w-[140px] max-w-[260px] wrap-anywhere'
													)}
												>
													{nome}
												</th>
												<td className={classesTabela.numero}>
													<div className="flex items-center justify-end gap-2">
														{!conjunto && (
															<span
																className="hidden h-2 w-16 overflow-hidden rounded-full bg-panel-chip sm:block"
																aria-hidden="true"
															>
																<span
																	className={cx(
																		'block h-full rounded-full',
																		corBarra
																	)}
																	style={{
																		width: `${larguraPerfil(valor, maior)}%`
																	}}
																/>
															</span>
														)}
														{valor === null ? (
															<>
																<span aria-hidden="true">...</span>
																<span className="sr-only">Não disponível</span>
															</>
														) : (
															formatarTaxa(valor)
														)}
													</div>
												</td>
												<CelulaNumero valor={item.base_risco} />
												<td className={classesTabela.texto}>
													<ListaAvisos avisos={avisosDoRecorte(item)} />
												</td>
											</tr>
										)
									})}
								</tbody>
							</Tabela>
							<NotaTabela
								exportar={{
									arquivo: `evasao-mt-perfil-${dados.fator.codigo}-${selecao.ano}.csv`,
									rotulo: `Baixar CSV do perfil: ${dados.fator.nome}`,
									gerar: () =>
										csvPerfil(
											dados.fator.nome,
											dados.conjunto
												? [
														...dados.categorias,
														{
															...dados.conjunto,
															categoria: {
																codigo: null,
																nome: 'Todas as categorias',
																ordem: null
															}
														}
													]
												: dados.categorias,
											descreverRecorte(
												Object.fromEntries(new URLSearchParams(exibido!.query))
											)
										)
								}}
							/>
						</>
					)}
				</div>
			)}
		</section>
	)
}
