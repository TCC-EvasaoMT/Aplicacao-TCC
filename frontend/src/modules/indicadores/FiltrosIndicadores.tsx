import { useEffect, useState } from 'react'
import { Button } from 'primereact/button'
import { Sidebar } from 'primereact/sidebar'
import { CampoLista } from '../../lib/CampoLista'
import { Ajuda, classes } from '../../lib/ui'
import type { Catalogo } from '../catalogos'
import {
	camposFiltro,
	filtrosAtivos,
	rotuloOpcao,
	type SelecaoFiltros
} from './filtros'

// Listas longas (cursos, municípios) ganham busca por nome ou código.
const LIMITE_SEM_BUSCA = 10

interface Props {
	catalogo: Catalogo | null
	selecao: SelecaoFiltros
	carregando: boolean
	indisponivel: boolean
	aberto: boolean
	onFechar: () => void
	onChange: (chave: keyof SelecaoFiltros, valor: string) => void
	onLimpar: () => void
}

// Gaveta com os sete filtros, aberta pelo botão da faixa do recorte. Os
// filtros valem na hora; a gaveta pode ficar aberta enquanto a página atualiza.
export function FiltrosIndicadores({
	catalogo,
	selecao,
	carregando,
	indisponivel,
	aberto,
	onFechar,
	onChange,
	onLimpar
}: Props) {
	const [avisoLink, setAvisoLink] = useState('')
	// O Sidebar não prende o foco nem o devolve ao fechar: a página por trás
	// fica inerte enquanto a gaveta está aberta e o foco volta ao botão.
	useEffect(() => {
		if (!aberto) return
		const pagina = document.getElementById('root')
		const anterior = document.activeElement as HTMLElement | null
		pagina?.setAttribute('inert', '')
		return () => {
			pagina?.removeAttribute('inert')
			anterior?.focus()
		}
	}, [aberto])
	async function copiarLink() {
		try {
			await navigator.clipboard.writeText(window.location.href)
			setAvisoLink('Link desta visão copiado.')
		} catch {
			setAvisoLink('Não foi possível copiar. Use o endereço do navegador.')
		}
	}
	const desabilitado = carregando || indisponivel || !catalogo?.anos.length
	const quantidade = filtrosAtivos(selecao, catalogo).length
	return (
		<Sidebar
			visible={aberto}
			position="right"
			blockScroll
			// O Esc de uma lista aberta fecha só a lista, não a gaveta.
			closeOnEscape={false}
			onKeyDown={(event) => {
				const lista = (event.target as Element).closest(
					'[data-pc-name=dropdown]'
				)
				if (event.key === 'Escape' && !lista?.querySelector('[role=listbox]'))
					onFechar()
			}}
			aria-labelledby="filtros-titulo"
			header={
				<h2 id="filtros-titulo" className="text-white">
					Filtros
				</h2>
			}
			onHide={onFechar}
		>
			<p className="text-sm font-semibold" aria-live="polite">
				{quantidade === 0
					? 'Nenhum filtro: todos os cursos.'
					: quantidade === 1
						? '1 filtro aplicado.'
						: `${quantidade} filtros aplicados.`}
			</p>
			<Ajuda id="filtros-ajuda">
				Aplicados na hora ao resumo, à evolução temporal e às comparações. Os
				resultados atendem a todos os filtros selecionados.
			</Ajuda>
			<div className="mt-4 grid gap-4" aria-describedby="filtros-ajuda">
				{camposFiltro.map((campo) => {
					const opcoes = catalogo?.[campo.catalogo] ?? []
					const itens = [
						{
							value: '',
							label: opcoes.length ? 'Todos' : 'Sem opções disponíveis'
						},
						...opcoes.map((opcao) => ({
							value: typeof opcao === 'string' ? opcao : opcao.codigo,
							label: rotuloOpcao(opcao)
						}))
					]
					return (
						<div key={campo.chave}>
							<label className={classes.rotulo} htmlFor={campo.chave}>
								{campo.rotulo}
							</label>
							<CampoLista
								inputId={campo.chave}
								value={selecao[campo.chave]}
								options={itens}
								disabled={desabilitado || !opcoes.length}
								filter={opcoes.length > LIMITE_SEM_BUSCA}
								filterPlaceholder="Buscar por nome ou código…"
								filterInputAutoFocus
								resetFilterOnHide
								aria-describedby={
									campo.chave.includes('municipio')
										? 'municipios-ajuda'
										: undefined
								}
								onChange={(valor) => onChange(campo.chave, valor)}
							/>
						</div>
					)
				})}
			</div>
			<Ajuda id="municipios-ajuda">
				Oferta é o local do curso; sede é o local da instituição. Em EaD, a sede
				não substitui a oferta ausente.
			</Ajuda>
			<div className="mt-6 flex flex-wrap gap-2 border-t border-panel-line pt-4">
				<Button label="Ver resultados" onClick={onFechar} />
				<Button
					label="Limpar filtros"
					outlined
					disabled={desabilitado || quantidade === 0}
					onClick={onLimpar}
				/>
				<Button
					label="Copiar link"
					outlined
					disabled={desabilitado}
					onClick={copiarLink}
				/>
			</div>
			<Ajuda className="empty:hidden" role="status">
				{avisoLink}
			</Ajuda>
		</Sidebar>
	)
}
