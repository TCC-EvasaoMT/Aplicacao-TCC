import { useState } from 'react'
import { Button } from 'primereact/button'
import { CampoLista } from '../../lib/CampoLista'
import { Ajuda, classes, cx } from '../../lib/ui'
import { useMedia } from '../../lib/useMedia'
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
	// No celular, os sete campos ocupam mais de uma tela; ficam recolhidos
	// atrás de um botão. Os filtros ativos aparecem na faixa do recorte.
	const estreito = useMedia('(max-width: 575px)')
	const [aberto, setAberto] = useState(false)
	const [avisoLink, setAvisoLink] = useState('')
	async function copiarLink() {
		try {
			await navigator.clipboard.writeText(window.location.href)
			setAvisoLink('Link desta visão copiado.')
		} catch {
			setAvisoLink('Não foi possível copiar. Use o endereço do navegador.')
		}
	}
	const mostrarCampos = !estreito || aberto
	const desabilitado = carregando || indisponivel || !catalogo?.anos.length
	const quantidade = filtrosAtivos(selecao, catalogo).length
	return (
		<section
			className="mb-6 rounded-lg border border-panel-line bg-panel-surface p-4 sm:px-6"
			aria-labelledby="filtros-titulo"
			aria-busy={carregando}
		>
			<div className={cx(classes.cabecalhoSecao, 'mb-2')}>
				<div>
					<h2 id="filtros-titulo">Filtros compartilhados</h2>
					<p className="mt-1 text-sm text-panel-muted">
						{quantidade === 0
							? 'Todos os recortes disponíveis.'
							: quantidade === 1
								? '1 filtro aplicado.'
								: `${quantidade} filtros aplicados.`}
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					{estreito && (
						<Button
							label={aberto ? 'Ocultar filtros' : 'Mostrar filtros'}
							outlined
							size="small"
							aria-expanded={aberto}
							aria-controls="filtros-campos"
							onClick={() => setAberto((valor) => !valor)}
						/>
					)}
					<Button
						label="Limpar filtros"
						outlined
						size="small"
						disabled={desabilitado || quantidade === 0}
						onClick={onLimpar}
					/>
					<Button
						label="Copiar link"
						outlined
						size="small"
						disabled={desabilitado}
						onClick={copiarLink}
					/>
				</div>
			</div>
			<Ajuda className="empty:hidden" role="status">
				{avisoLink}
			</Ajuda>
			<div id="filtros-campos" hidden={!mostrarCampos}>
				<Ajuda id="filtros-ajuda">
					Aplicados automaticamente ao resumo, à evolução temporal e às
					comparações. Os resultados atendem a todos os filtros selecionados.
				</Ajuda>
				<div
					className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 md:grid-cols-4"
					aria-describedby="filtros-ajuda"
				>
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
							<div
								className={
									campo.chave === 'codigo_curso' ? 'sm:col-span-2' : undefined
								}
								key={campo.chave}
							>
								<label className={classes.rotulo} htmlFor={campo.chave}>
									{campo.rotulo}
								</label>
								<CampoLista
									inputId={campo.chave}
									value={selecao[campo.chave]}
									options={itens}
									disabled={desabilitado || !opcoes.length}
									filter={opcoes.length > LIMITE_SEM_BUSCA}
									filterPlaceholder="Buscar por nome ou código"
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
					Oferta é o local do curso; sede é o local da instituição. Em EaD, a
					sede não substitui a oferta ausente.
				</Ajuda>
			</div>
		</section>
	)
}
