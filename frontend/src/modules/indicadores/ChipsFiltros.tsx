import { useEffect, useRef, useState } from 'react'
import { useMedia } from '../../lib/useMedia'
import type { Resumo } from './api'
import type { CampoFiltro, FiltroAtivo } from './filtros'

const percentual = new Intl.NumberFormat('pt-BR', {
	style: 'percent',
	maximumFractionDigits: 2
})
const taxa = (valor: number | null | undefined) =>
	valor == null ? 'Não disponível' : percentual.format(valor)

interface Props {
	ano: string
	ativos: FiltroAtivo[]
	// Taxas do recorte atual; ficam visíveis mesmo com o resumo fora da tela.
	resumo?: Resumo
	onRemover: (chave: CampoFiltro) => void
	onLimpar: () => void
}

// Faixa fixa com o recorte atual: ano, filtros removíveis e as duas taxas.
export function ChipsFiltros({
	ano,
	ativos,
	resumo,
	onRemover,
	onLimpar
}: Props) {
	const estreito = useMedia('(max-width: 575px)')
	const [expandido, setExpandido] = useState(false)
	const [anuncio, setAnuncio] = useState('')
	const anteriores = useRef<FiltroAtivo[] | null>(null)

	// Anuncia o que mudou para leitores de tela (não na primeira carga).
	useEffect(() => {
		const antes = anteriores.current
		anteriores.current = ativos
		if (!antes) return
		// Compara por campo e valor: o rótulo muda quando o catálogo chega.
		const id = (filtro: FiltroAtivo) => `${filtro.chave}=${filtro.valor}`
		const texto = (filtro: FiltroAtivo) => `${filtro.campo} ${filtro.texto}`
		const ids = new Set(antes.map(id))
		const novos = ativos.filter((filtro) => !ids.has(id(filtro)))
		const atuais = new Set(ativos.map(id))
		const removidos = antes.filter(
			(filtro) =>
				!atuais.has(id(filtro)) &&
				!novos.some((novo) => novo.chave === filtro.chave)
		)
		const partes = [
			...novos.map((filtro) => `Filtro aplicado: ${texto(filtro)}.`),
			...removidos.map((filtro) => `Filtro removido: ${texto(filtro)}.`)
		]
		if (partes.length)
			setAnuncio(
				`${partes.join(' ')} Resumo, evolução e comparação atualizados.`
			)
	}, [ativos])

	const compacto = estreito && !expandido && ativos.length > 1
	const visiveis = compacto ? ativos.slice(0, 1) : ativos
	return (
		<div className="recorte" role="region" aria-label="Recorte atual">
			<span className="recorte-ano">{ano ? `Ano ${ano}` : 'Ano'}</span>
			{ativos.length === 0 ? (
				<span className="recorte-vazio">Todos os recortes</span>
			) : (
				<ul className="chips" aria-label="Filtros ativos">
					{visiveis.map((filtro) => (
						<li className="chip" key={filtro.chave}>
							<span>
								{filtro.campo}: {filtro.texto}
							</span>
							<button
								type="button"
								className="chip-remover"
								aria-label={`Remover filtro ${filtro.campo}: ${filtro.texto}`}
								onClick={() => onRemover(filtro.chave)}
							>
								<span aria-hidden="true">×</span>
							</button>
						</li>
					))}
					{estreito && ativos.length > 1 && (
						<li>
							<button
								type="button"
								className="chip-mais"
								aria-expanded={expandido}
								onClick={() => setExpandido((valor) => !valor)}
							>
								{expandido ? 'Menos' : `+${ativos.length - 1}`}
								<span className="visually-hidden">
									{expandido ? ' filtros' : ' filtros ativos'}
								</span>
							</button>
						</li>
					)}
				</ul>
			)}
			{ativos.length > 0 && (
				<button type="button" className="chip-limpar" onClick={onLimpar}>
					Limpar tudo
				</button>
			)}
			{resumo &&
				(resumo.taxas.evasao_curso !== null ||
					resumo.taxas.evasao_ies !== null) && (
					<p className="recorte-taxas">
						<span>Evasão: curso {taxa(resumo.taxas.evasao_curso)}</span>
						<span>instituição {taxa(resumo.taxas.evasao_ies)}</span>
					</p>
				)}
			<p className="visually-hidden" role="status">
				{anuncio}
			</p>
		</div>
	)
}
