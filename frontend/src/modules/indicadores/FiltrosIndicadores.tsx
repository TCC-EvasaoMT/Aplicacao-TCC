import type { Catalogo } from '../catalogos'
import { camposFiltro, type SelecaoFiltros } from './filtros'

interface Props {
	catalogo: Catalogo | null
	selecao: SelecaoFiltros
	carregando: boolean
	indisponivel: boolean
	onChange: (chave: keyof SelecaoFiltros, valor: string) => void
	onLimpar: () => void
}

export function FiltrosIndicadores({
	catalogo,
	selecao,
	carregando,
	indisponivel,
	onChange,
	onLimpar
}: Props) {
	const desabilitado = carregando || indisponivel || !catalogo?.anos.length
	const quantidade = camposFiltro.filter(
		(campo) => selecao[campo.chave] !== ''
	).length
	return (
		<section
			className="filters"
			aria-labelledby="filtros-titulo"
			aria-busy={carregando}
		>
			<div className="section-heading">
				<h2 id="filtros-titulo">Filtros compartilhados</h2>
				<button
					className="btn btn-outline-success btn-sm"
					disabled={desabilitado || quantidade === 0}
					onClick={onLimpar}
				>
					Limpar filtros
				</button>
			</div>
			<p className="filter-help" id="filtros-ajuda">
				Aplicados automaticamente ao resumo, à evolução temporal e às
				comparações. Os resultados atendem a todos os filtros selecionados.
			</p>
			<div className="row g-3 align-items-end" aria-describedby="filtros-ajuda">
				{camposFiltro.map((campo) => {
					const opcoes = catalogo?.[campo.catalogo] ?? []
					return (
						<div
							className={
								campo.chave === 'codigo_curso'
									? 'col-12 col-md-6'
									: 'col-12 col-sm-6 col-md-3'
							}
							key={campo.chave}
						>
							<label className="form-label" htmlFor={campo.chave}>
								{campo.rotulo}
							</label>
							<select
								className="form-select"
								id={campo.chave}
								name={campo.chave}
								value={selecao[campo.chave]}
								disabled={desabilitado || !opcoes.length}
								aria-describedby={
									campo.chave.includes('municipio')
										? 'municipios-ajuda'
										: undefined
								}
								onChange={(event) => onChange(campo.chave, event.target.value)}
							>
								<option value="">
									{opcoes.length ? 'Todos' : 'Sem opções disponíveis'}
								</option>
								{opcoes.map((opcao) => {
									const valor = typeof opcao === 'string' ? opcao : opcao.codigo
									const rotulo =
										typeof opcao === 'string'
											? opcao
											: `${opcao.nome ?? 'Nome não informado'} (${opcao.codigo})`
									return (
										<option key={valor} value={valor}>
											{rotulo}
										</option>
									)
								})}
							</select>
						</div>
					)
				})}
			</div>
			<p className="filter-help" id="municipios-ajuda">
				Oferta é o local do curso; sede é o local da instituição. Em EaD, a sede
				não substitui a oferta ausente.
			</p>
			<p className="filter-count">
				{quantidade === 0
					? 'Todos os recortes disponíveis.'
					: quantidade === 1
						? '1 filtro aplicado.'
						: `${quantidade} filtros aplicados.`}
			</p>
		</section>
	)
}
