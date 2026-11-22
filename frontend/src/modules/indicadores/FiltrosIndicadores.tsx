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
				<h2 id="filtros-titulo">Filtros do painel</h2>
				<button
					className="refresh"
					disabled={desabilitado || quantidade === 0}
					onClick={onLimpar}
				>
					Limpar filtros
				</button>
			</div>
			<p className="filter-help" id="filtros-ajuda">
				As seleções são combinadas: o resultado atende a todos os filtros. As
				alterações são aplicadas automaticamente ao resumo e à evolução
				temporal. O ano abaixo vale apenas para o resumo; o gráfico possui seu
				próprio período.
			</p>
			<div className="filter-grid" aria-describedby="filtros-ajuda">
				<div className="filter-field">
					<label htmlFor="ano">Ano do resumo</label>
					<select
						id="ano"
						value={selecao.ano}
						disabled={desabilitado}
						onChange={(event) => onChange('ano', event.target.value)}
					>
						{!catalogo?.anos.length && (
							<option value="">
								{carregando ? 'Carregando…' : 'Sem anos disponíveis'}
							</option>
						)}
						{catalogo?.anos.map((ano) => (
							<option key={ano} value={ano}>
								{ano}
							</option>
						))}
					</select>
				</div>
				{camposFiltro.map((campo) => {
					const opcoes = catalogo?.[campo.catalogo] ?? []
					return (
						<div className="filter-field" key={campo.chave}>
							<label htmlFor={campo.chave}>{campo.rotulo}</label>
							<select
								id={campo.chave}
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
				Município de oferta é o local do curso; município da sede é o da
				instituição. Em EaD, a sede não substitui um local de oferta ausente. As
				características institucionais podem representar mais de uma IES.
			</p>
			<p className="filter-count">
				{quantidade === 0
					? 'Sem restrições de curso, área, modalidade, instituição ou município.'
					: `${quantidade} filtro(s) adicional(is) selecionado(s).`}
			</p>
		</section>
	)
}
