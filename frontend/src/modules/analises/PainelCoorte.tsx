import { lazy, Suspense, useEffect, useState } from 'react'
import { Button } from 'primereact/button'
import { Message } from 'primereact/message'
import { Carregando, GraficoCarregando } from '../../lib/Estados'
import { mensagemErro } from '../../lib/http'
import { LimiteErro } from '../../lib/LimiteErro'
import { CampoLista } from '../../lib/CampoLista'
import { Ajuda, classes, cx } from '../../lib/ui'
import { gravarUrl, lerUrl } from '../../lib/url'
import type { SelecaoFiltros } from '../indicadores'
import { consultarCoorte, type Coorte } from './api'
import { formatarTaxa, plural } from './apresentacao'
import {
	lerTaxaTurma,
	lerTurma,
	serializarCoorte,
	taxasTurma,
	ultimoAnoCompleto,
	type TaxaTurma
} from './coorte'

const GraficoCoorte = lazy(() =>
	import('./GraficoCoorte').then((m) => ({ default: m.GraficoCoorte }))
)

interface Props {
	anos: number[]
	selecao: SelecaoFiltros
	atualizacao: number
	indisponivel: boolean
}

export function PainelCoorte({
	anos,
	selecao,
	atualizacao,
	indisponivel
}: Props) {
	const [turmaEscolhida, setTurma] = useState(() => lerTurma(lerUrl(), anos))
	const [taxa, setTaxa] = useState<TaxaTurma>(() => lerTaxaTurma(lerUrl()))
	const [tentativa, setTentativa] = useState(0)
	// O catálogo chega depois da primeira renderização.
	const turma = anos.includes(Number(turmaEscolhida))
		? turmaEscolhida
		: lerTurma(lerUrl(), anos)
	const padrao = anos.length ? String(Math.min(...anos)) : ''
	const podeConsultar = !indisponivel && turma !== ''
	const query = podeConsultar ? serializarCoorte(selecao, turma) : ''
	const chave = `${atualizacao}:${tentativa}:${query}`
	const [resposta, setResposta] = useState<{
		chave: string
		dados?: Coorte
		erro?: string
	} | null>(null)
	const [ultimo, setUltimo] = useState<{ dados: Coorte; query: string } | null>(
		null
	)

	useEffect(() => {
		if (!podeConsultar) return
		const controller = new AbortController()
		consultarCoorte(query, controller.signal)
			.then((dados) => {
				if (controller.signal.aborted) return
				setResposta({ chave, dados })
				setUltimo({ dados, query })
			})
			.catch((falha) => {
				if (!controller.signal.aborted)
					setResposta({
						chave,
						erro: mensagemErro(falha, 'Não foi possível carregar a turma.')
					})
			})
		return () => controller.abort()
	}, [query, chave, podeConsultar])

	useEffect(() => {
		if (!turma) return
		gravarUrl(
			['turma', 'taxa_turma'],
			[
				...(turma === padrao ? [] : [['turma', turma] as [string, string]]),
				...(taxa === taxasTurma[0]!.valor
					? []
					: [['taxa_turma', taxa] as [string, string]])
			]
		)
	}, [turma, padrao, taxa])

	const atual = resposta?.chave === chave ? resposta : null
	const carregando = podeConsultar && !atual
	const exibido = atual?.dados ? { dados: atual.dados, query } : ultimo
	const dados = exibido?.dados
	const ultimoAno = dados ? ultimoAnoCompleto(dados, taxa) : null
	const rotuloEvasao = taxasTurma.find((t) => t.valor === taxa)!.rotulo

	return (
		<section
			className={cx(classes.secao, 'mt-6')}
			aria-labelledby="turma-titulo"
			aria-busy={carregando}
		>
			<div className={classes.cabecalhoSecao}>
				<h2 id="turma-titulo" className={classes.titulo}>
					Turma de ingresso
				</h2>
				<div className="flex flex-wrap items-end gap-4">
					<div className={classes.campoAno}>
						<label className={classes.rotulo} htmlFor="turma-ano">
							Ano de ingresso
						</label>
						<CampoLista
							inputId="turma-ano"
							value={turma}
							options={
								anos.length
									? [...anos]
											.sort((a, b) => a - b)
											.map((ano) => ({
												value: String(ano),
												label: String(ano)
											}))
									: [{ value: '', label: 'Sem anos disponíveis' }]
							}
							disabled={!anos.length}
							onChange={setTurma}
						/>
					</div>
					<div className="min-w-56">
						<label className={classes.rotulo} htmlFor="turma-taxa">
							Saída
						</label>
						<CampoLista
							inputId="turma-taxa"
							value={taxa}
							options={taxasTurma.map(({ valor, rotulo }) => ({
								value: valor,
								label: rotulo
							}))}
							onChange={(valor) => setTaxa(valor as TaxaTurma)}
						/>
					</div>
				</div>
			</div>
			<Ajuda>
				Acompanha a mesma turma: os vínculos de quem ingressou no ano escolhido,
				em cada censo seguinte, como proporção do tamanho inicial. A evolução
				acima compara censos diferentes; aqui, a turma é a mesma. Só entram os
				cursos que têm a turma no ano de ingresso, e os filtros do painel se
				aplicam, menos o ano do resumo. Um salto de um ano para outro pode
				refletir saídas registradas de uma só vez, e não saídas daquele ano.
			</Ajuda>
			<div aria-live="polite">
				{!podeConsultar && (
					<p className={cx(classes.estado, 'mt-4')}>
						Aguardando anos e filtros disponíveis.
					</p>
				)}
				{carregando && !exibido && <Carregando texto="Carregando turma…" />}
				{!carregando && atual?.erro && (
					<Message
						severity="error"
						content={
							<>
								<p className="mb-3">{atual.erro}</p>
								<Button
									label="Tentar turma novamente"
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
				<div className={cx('mt-4', carregando && classes.atualizando)}>
					{dados.tamanho_inicial === null || dados.serie.length === 0 ? (
						<p className={classes.estado}>
							A turma de {turma} não tem linha no censo do ano de ingresso neste
							recorte, então não há tamanho inicial para acompanhar.
						</p>
					) : (
						<>
							<Ajuda className="mt-0">
								Turma de {turma}:{' '}
								{plural(
									dados.tamanho_inicial,
									'vínculo inicial',
									'vínculos iniciais'
								)}{' '}
								em {plural(dados.cursos_iniciais, 'curso', 'cursos')}.{' '}
								{ultimoAno
									? `Em ${ultimoAno.ano}, ${rotuloEvasao.toLowerCase()}: ${formatarTaxa(ultimoAno.taxas[taxa])}; já concluiu: ${formatarTaxa(ultimoAno.taxas.concluiu)}; continua no curso: ${formatarTaxa(ultimoAno.taxas.continua)}.`
									: 'Nenhum ano tem as três proporções calculáveis.'}
							</Ajuda>
							<LimiteErro mensagem="Não foi possível exibir o gráfico da turma.">
								<Suspense fallback={<GraficoCarregando />}>
									<GraficoCoorte
										coorte={{
											...dados,
											tamanho_inicial: dados.tamanho_inicial
										}}
										anoIngresso={Number(turma)}
										taxa={taxa}
										parametros={Object.fromEntries(
											new URLSearchParams(exibido!.query)
										)}
									/>
								</Suspense>
							</LimiteErro>
						</>
					)}
				</div>
			)}
		</section>
	)
}
