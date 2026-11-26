import { useEffect, useState } from 'react'
import { Button } from 'primereact/button'
import { cx } from '../../lib/ui'
import { useMedia } from '../../lib/useMedia'
import type { Resumo } from './api'
import type { CampoFiltro, FiltroAtivo } from './filtros'

const percentual = new Intl.NumberFormat('pt-BR', {
	style: 'percent',
	maximumFractionDigits: 2
})
const taxa = (valor: number | null | undefined) =>
	valor == null ? 'Não disponível' : percentual.format(valor)

// Contorno do foco menor que o global: o padrão (offset 4 px) invadiria o
// chip vizinho.
const focoCompacto =
	'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-panel-ink'
const transicaoCores = 'motion-safe:transition-colors motion-safe:duration-150'

interface Props {
	ano: string
	ativos: FiltroAtivo[]
	// Taxas do recorte atual; ficam visíveis mesmo com o resumo fora da tela.
	resumo?: Resumo
	// Texto para leitores de tela sobre a última mudança feita pela pessoa.
	anuncio: string
	filtrosAbertos: boolean
	onAbrirFiltros: () => void
	onRemover: (chave: CampoFiltro) => void
	onLimpar: () => void
}

// Faixa fixa com o recorte atual: ano, filtros removíveis e as duas taxas.
// Fica no topo ao rolar, para o clique num gráfico mostrar o filtro e as
// taxas sem voltar ao início da página.
export function ChipsFiltros({
	ano,
	ativos,
	resumo,
	anuncio,
	filtrosAbertos,
	onAbrirFiltros,
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

	// Compacta: o primeiro filtro divide a linha com o ano e o "+N", só com o
	// valor; o nome do campo fica no title e no ×. "Limpar tudo" aparece ao
	// expandir (o cartão de filtros também tem "Limpar filtros").
	const compacto = estreito && !expandido && ativos.length > 1
	const visiveis = compacto ? ativos.slice(0, 1) : ativos
	return (
		<div
			className={cx(
				'sticky top-1 z-[5] -mx-2 mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-l-[3px] border-panel-border border-l-panel-green bg-panel-surface px-2 py-1.5 text-sm',
				'shadow-[0_1px_2px_rgb(23_46_41/10%),0_6px_16px_rgb(23_46_41/8%)]',
				'sm:top-2 sm:mx-0 sm:mb-6 sm:gap-x-3 sm:gap-y-2 sm:border-l-4 sm:px-3 sm:py-2'
			)}
			role="region"
			aria-label="Recorte atual"
		>
			<Button
				label={ativos.length ? `Filtros (${ativos.length})` : 'Filtros'}
				size="small"
				className="flex-none"
				aria-haspopup="dialog"
				aria-expanded={filtrosAbertos}
				onClick={onAbrirFiltros}
			/>
			<span className="flex-none border-r border-panel-line pr-2 font-bold tabular-nums sm:pr-3">
				{ano ? `Ano ${ano}` : 'Ano'}
			</span>
			{ativos.length === 0 ? (
				<span className="text-panel-muted">Todos os cursos</span>
			) : (
				<ul
					className={cx(
						'm-0 flex list-none gap-2 p-0',
						compacto ? 'min-w-0 flex-1 basis-0 flex-nowrap' : 'flex-wrap'
					)}
					aria-label="Filtros ativos"
				>
					{visiveis.map((filtro) => (
						<li
							className={cx(
								'inline-flex min-h-7 items-center gap-1 rounded border border-panel-border bg-panel-chip pr-[3px] pl-2.5 text-[0.8125rem] font-semibold wrap-anywhere text-panel-green sm:min-h-8 sm:text-sm',
								'motion-safe:animate-[chip-entrada_0.12s_ease-out]',
								compacto && 'min-w-0'
							)}
							key={filtro.chave}
						>
							<span
								className={compacto ? 'min-w-0 truncate' : undefined}
								title={`${filtro.campo}: ${filtro.texto}`}
							>
								<span className={compacto ? 'hidden' : undefined}>
									{filtro.campo}:{' '}
								</span>
								{filtro.texto}
							</span>
							<button
								type="button"
								className={cx(
									// Área de toque de 44 px sem aumentar o chip.
									'relative inline-flex size-7 items-center justify-center rounded text-lg leading-none text-inherit before:absolute before:-inset-x-1 before:-inset-y-2 before:content-[""]',
									'hover:bg-panel-green hover:text-white focus-visible:bg-panel-surface',
									focoCompacto,
									transicaoCores
								)}
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
								className={cx(
									'min-h-8 rounded border border-panel-border bg-panel-surface px-2.5 font-semibold text-panel-green hover:border-panel-green hover:bg-panel-chip',
									focoCompacto,
									transicaoCores
								)}
								aria-expanded={expandido}
								onClick={() => setExpandido((valor) => !valor)}
							>
								{expandido ? 'Menos' : `+${ativos.length - 1}`}
								<span className="sr-only">
									{expandido ? ' filtros' : ' filtros ativos'}
								</span>
							</button>
						</li>
					)}
				</ul>
			)}
			{ativos.length > 0 && !compacto && (
				<button
					type="button"
					className={cx(
						'ml-auto min-h-8 rounded px-2 py-1 font-semibold text-panel-green underline decoration-1 underline-offset-[3px] hover:bg-panel-chip hover:decoration-2 sm:ml-0',
						focoCompacto
					)}
					onClick={onLimpar}
				>
					Limpar tudo
				</button>
			)}
			{resumo &&
				(resumo.taxas.evasao_curso !== null ||
					resumo.taxas.evasao_ies !== null) && (
					<p className="ml-auto hidden gap-4 text-panel-ink tabular-nums sm:flex">
						{/* Quadrado na cor da série, igual ao gráfico e aos cartões. */}
						<span className="whitespace-nowrap before:mr-1.5 before:inline-block before:size-2 before:rounded-xs before:bg-panel-green before:content-['']">
							Evasão: curso {taxa(resumo.taxas.evasao_curso)}
						</span>
						<span className="whitespace-nowrap before:mr-1.5 before:inline-block before:size-2 before:rounded-xs before:bg-panel-secondary before:content-['']">
							instituição {taxa(resumo.taxas.evasao_ies)}
						</span>
					</p>
				)}
			<p className="sr-only" role="status">
				{anuncio}
			</p>
		</div>
	)
}
