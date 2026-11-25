import { useState } from 'react'
import { Accordion, AccordionTab } from 'primereact/accordion'
import { Button } from 'primereact/button'
import { Checkbox } from 'primereact/checkbox'
import { InputText } from 'primereact/inputtext'
import { Ajuda, classes } from '../../lib/ui'
import { plural } from './apresentacao'
import { alternarGrupo, limiteGrupos } from './comparacoes'

interface Props {
	opcoes: { valor: string; rotulo: string }[]
	grupos: string[]
	desabilitado: boolean
	onChange: (grupos: string[]) => void
}

function normalizar(texto: string) {
	return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('pt-BR')
}

export function SeletorGrupos({
	opcoes,
	grupos,
	desabilitado,
	onChange
}: Props) {
	// A busca fica fora do painel recolhível: fechar e abrir não a apaga.
	const [busca, setBusca] = useState('')
	const valores = new Set(opcoes.map((opcao) => opcao.valor))
	const disponiveis = [
		...opcoes,
		...grupos
			.filter((valor) => !valores.has(valor))
			.map((valor) => ({ valor, rotulo: `${valor} (fora do catálogo atual)` }))
	]
	const visiveis = disponiveis
		.map((opcao, indice) => ({ ...opcao, id: `comparacao-grupo-${indice}` }))
		.filter((opcao) =>
			normalizar(opcao.rotulo).includes(normalizar(busca.trim()))
		)
	return (
		<Accordion className="my-4 border-y border-panel-line py-3">
			<AccordionTab
				header={`Selecionar grupos (${
					grupos.length ? `${grupos.length} de ${limiteGrupos}` : 'todos'
				})`}
			>
				<Ajuda id="comparacao-grupos-ajuda">
					Sem seleção, serão consultados até 20 grupos. As opções vêm de todos
					os anos e podem não ter dados no recorte atual.
				</Ajuda>
				<label className={classes.rotulo} htmlFor="comparacao-busca">
					Buscar por nome ou código
				</label>
				<InputText
					className="max-w-[480px]"
					id="comparacao-busca"
					type="search"
					value={busca}
					onChange={(event) => setBusca(event.target.value)}
				/>
				<fieldset
					className="my-3 max-h-60 overflow-y-auto p-1"
					aria-describedby="comparacao-grupos-ajuda comparacao-limite"
				>
					<legend className="sr-only">Grupos da comparação</legend>
					{visiveis.map((opcao) => {
						const marcado = grupos.includes(opcao.valor)
						return (
							<div className="flex items-start gap-3 p-2" key={opcao.valor}>
								<Checkbox
									inputId={opcao.id}
									checked={marcado}
									disabled={
										desabilitado || (grupos.length >= limiteGrupos && !marcado)
									}
									onChange={() => onChange(alternarGrupo(grupos, opcao.valor))}
								/>
								<label
									className="cursor-pointer wrap-anywhere"
									htmlFor={opcao.id}
								>
									{opcao.rotulo}
								</label>
							</div>
						)
					})}
					{!visiveis.length && (
						<Ajuda>
							Nenhum grupo encontrado. Altere a busca ou consulte sem selecionar
							grupos.
						</Ajuda>
					)}
				</fieldset>
				<Ajuda id="comparacao-limite" role="status">
					{grupos.length >= limiteGrupos
						? 'Limite de 20 grupos atingido. Desmarque um para selecionar outro.'
						: grupos.length === 0
							? 'Nenhum grupo selecionado.'
							: `${plural(grupos.length, 'grupo selecionado', 'grupos selecionados')}.`}
				</Ajuda>
				<Button
					label="Limpar seleção de grupos"
					outlined
					size="small"
					disabled={desabilitado || !grupos.length}
					onClick={() => onChange([])}
				/>
			</AccordionTab>
		</Accordion>
	)
}
