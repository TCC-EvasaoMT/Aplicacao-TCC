import { useEffect, useState, type FormEvent } from 'react'
import type { SelecaoFiltros } from '../indicadores'
import { consultarEvolucao, type EvolucaoTemporal } from './api'
import { GraficoEvolucao } from './GraficoEvolucao'
import {
	periodoInicial,
	serializarEvolucao,
	validarPeriodo,
	type Periodo
} from './periodo'

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
	const [tentativa, setTentativa] = useState(0)
	const [resposta, setResposta] = useState<{
		chave: string
		dados?: EvolucaoTemporal
		erro?: string
	} | null>(null)
	const padrao = periodoInicial(anos)
	const aplicado = periodo ?? padrao
	const campos = rascunho ?? aplicado
	const query = serializarEvolucao(aplicado, selecao)
	const podeConsultar =
		!indisponivel && anos.length > 0 && !validarPeriodo(aplicado)
	const chave = `${atualizacao}:${tentativa}:${query}`

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
	}

	return (
		<section
			className="temporal"
			aria-labelledby="evolucao-titulo"
			aria-busy={carregando}
		>
			<h2 id="evolucao-titulo">Evolução temporal</h2>
			<p className="filter-help">
				Compare as taxas anuais com os mesmos filtros do painel. O ano do resumo
				não limita este gráfico. A série descreve censos anuais, não o
				acompanhamento de uma coorte.
			</p>
			<form
				className="temporal-period"
				onSubmit={aplicar}
				noValidate
				aria-describedby="periodo-ajuda"
			>
				{(['ano_inicial', 'ano_final'] as const).map((campo) => (
					<div key={campo}>
						<label htmlFor={campo}>
							{campo === 'ano_inicial' ? 'Ano inicial' : 'Ano final'}
						</label>
						<input
							id={campo}
							type="number"
							min={1900}
							max={9999}
							step={1}
							required
							value={campos[campo]}
							disabled={indisponivel || !anos.length}
							aria-invalid={!!erroPeriodo}
							aria-describedby={erroPeriodo ? 'periodo-erro' : 'periodo-ajuda'}
							onChange={(event) => {
								setRascunho({ ...campos, [campo]: event.target.value })
								setErroPeriodo('')
							}}
						/>
					</div>
				))}
				<button
					className="refresh"
					disabled={indisponivel || !anos.length}
					type="submit"
				>
					Aplicar período
				</button>
			</form>
			<p id="periodo-ajuda" className="filter-help">
				De 1 a 30 anos, incluindo os extremos. Anos sem dados permanecem como
				lacunas.
			</p>
			{erroPeriodo && (
				<p id="periodo-erro" className="error" role="alert">
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
				{carregando && <p className="state">Carregando evolução temporal…</p>}
				{podeConsultar && atual?.erro && (
					<div className="state error" role="alert">
						<p>{atual.erro}</p>
						<button
							className="refresh"
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
					<GraficoEvolucao serie={atual.dados.serie} />
				</>
			)}
		</section>
	)
}
