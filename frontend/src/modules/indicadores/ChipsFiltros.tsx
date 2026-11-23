import { useEffect, useState } from 'react'
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
	// Texto para leitores de tela sobre a última mudança feita pela pessoa.
	anuncio: string
	onRemover: (chave: CampoFiltro) => void
	onLimpar: () => void
}

// Faixa fixa com o recorte atual: ano, filtros removíveis e as duas taxas.
export function ChipsFiltros({
	ano,
	ativos,
	resumo,
	anuncio,
	onRemover,
	onLimpar
}: Props) {
	const estreito = useMedia('(max-width: 575px)')
	const [expandido, setExpandido] = useState(false)

	// No celular a lista aberta ocupa boa parte da tela e a faixa é fixa:
	// recolhe ao rolar a página ou quando os filtros mudam.
	const assinatura = ativos
		.map((filtro) => `${filtro.chave}=${filtro.valor}`)
		.join('&')
	useEffect(() => setExpandido(false), [assinatura])
	useEffect(() => {
		if (!expandido) return
		const inicio = window.scrollY
		const aoRolar = () => {
			if (Math.abs(window.scrollY - inicio) > 24) setExpandido(false)
		}
		window.addEventListener('scroll', aoRolar, { passive: true })
		return () => window.removeEventListener('scroll', aoRolar)
	}, [expandido])

	const compacto = estreito && !expandido && ativos.length > 1
	const visiveis = compacto ? ativos.slice(0, 1) : ativos
	return (
		<div
			className={compacto ? 'recorte is-compact' : 'recorte'}
			role="region"
			aria-label="Recorte atual"
		>
			<span className="recorte-ano">{ano ? `Ano ${ano}` : 'Ano'}</span>
			{ativos.length === 0 ? (
				<span className="recorte-vazio">Todos os recortes</span>
			) : (
				<ul className="chips" aria-label="Filtros ativos">
					{visiveis.map((filtro) => (
						<li className="chip" key={filtro.chave}>
							<span title={`${filtro.campo}: ${filtro.texto}`}>
								<span className="chip-campo">{filtro.campo}: </span>
								{filtro.texto}
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
			{ativos.length > 0 && !compacto && (
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
