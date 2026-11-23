import { useState } from 'react'
import { alternarGrupo, limiteGrupos } from './comparacoes'

interface Props {
	opcoes: { valor: string; rotulo: string }[]
	grupos: string[]
	onChange: (grupos: string[]) => void
}

function normalizar(texto: string) {
	return texto
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLocaleLowerCase('pt-BR')
}

export function SeletorGrupos({ opcoes, grupos, onChange }: Props) {
	const [busca, setBusca] = useState('')
	const valores = new Set(opcoes.map((opcao) => opcao.valor))
	const disponiveis = [
		...opcoes,
		...grupos
			.filter((valor) => !valores.has(valor))
			.map((valor) => ({ valor, rotulo: `${valor} (fora do catálogo atual)` }))
	]
	const visiveis = disponiveis.filter((opcao) =>
		normalizar(opcao.rotulo).includes(normalizar(busca.trim()))
	)
	return (
		<details className="comparison-selection">
			<summary>
				Selecionar grupos (
				{grupos.length ? `${grupos.length} de ${limiteGrupos}` : 'todos'})
			</summary>
			<p className="filter-help" id="comparacao-grupos-ajuda">
				Sem seleção, serão consultados até 20 grupos. As opções vêm de todos os
				anos e podem não ter dados no recorte atual.
			</p>
			<label className="form-label" htmlFor="comparacao-busca">
				Buscar por nome ou código
			</label>
			<input
				className="form-control"
				id="comparacao-busca"
				type="search"
				value={busca}
				onChange={(event) => setBusca(event.target.value)}
			/>
			<fieldset
				className="comparison-options"
				aria-describedby="comparacao-grupos-ajuda comparacao-limite"
			>
				<legend className="visually-hidden">Grupos da comparação</legend>
				{visiveis.map((opcao) => (
					<label className="comparison-option" key={opcao.valor}>
						<input
							className="form-check-input"
							type="checkbox"
							checked={grupos.includes(opcao.valor)}
							disabled={
								grupos.length >= limiteGrupos && !grupos.includes(opcao.valor)
							}
							onChange={() => onChange(alternarGrupo(grupos, opcao.valor))}
						/>
						<span>{opcao.rotulo}</span>
					</label>
				))}
				{!visiveis.length && (
					<p className="filter-help">
						Nenhum grupo encontrado. Altere a busca ou consulte sem selecionar
						grupos.
					</p>
				)}
			</fieldset>
			<p id="comparacao-limite" className="filter-help" role="status">
				{grupos.length >= limiteGrupos
					? 'Limite de 20 grupos atingido. Desmarque um para selecionar outro.'
					: `${grupos.length} grupo(s) selecionado(s).`}
			</p>
			<button
				className="btn btn-outline-success btn-sm"
				type="button"
				disabled={!grupos.length}
				onClick={() => onChange([])}
			>
				Limpar seleção de grupos
			</button>
		</details>
	)
}
