import { useEffect, useState } from 'react'
import { Accordion, AccordionTab } from 'primereact/accordion'
import { TabMenu } from 'primereact/tabmenu'
import { gravarUrl, lerUrl } from './lib/url'
import { abasPainel, lerAba, PainelIndicadores } from './modules/indicadores'
import {
	AcessoAdministrativo,
	TelaAcesso,
	useAcessoPainel
} from './modules/autenticacao'

const notaLeitura = 'mt-3 max-w-[78ch] text-sm text-panel-muted'

export function App() {
	// Painel restrito: login antes das abas; público: liberado direto.
	const acesso = useAcessoPainel()
	const liberado = acesso.estado === 'liberado'
	const [aba, setAba] = useState(() => lerAba(lerUrl()))
	const indice = abasPainel.findIndex((item) => item.id === aba)
	useEffect(() => {
		gravarUrl(['aba'], aba === abasPainel[0].id ? [] : [['aba', aba]])
	}, [aba])
	return (
		<>
			<a
				className="fixed top-2 left-4 z-50 -translate-y-[150%] rounded bg-panel-surface px-4 py-3 font-semibold text-panel-green shadow-lg focus:translate-y-0"
				href="#conteudo"
			>
				Ir para o conteúdo
			</a>
			<header className="bg-panel-green text-white">
				<div className="mx-auto max-w-[1440px] px-[4%] pt-3">
					<div className="flex min-h-12 items-center justify-between gap-4">
						<a
							className="inline-flex items-center gap-3 text-xl font-bold no-underline"
							href="/"
						>
							<span
								className="rounded bg-panel-surface p-2 text-base leading-none text-panel-green"
								aria-hidden="true"
							>
								MT
							</span>{' '}
							Evasão MT
						</a>
						<div className="flex min-w-0 items-center gap-4">
							<span className="hidden text-sm text-white/80 lg:inline">
								Ensino superior público
							</span>
							{liberado && <AcessoAdministrativo />}
						</div>
					</div>
					<h1 className="mt-6 mb-2">Evasão no ensino superior</h1>
					<p className="max-w-[75ch] text-white/80">
						Instituições públicas com sede em Mato Grosso.
					</p>
					{/* O TabMenu se declara menu de navegação; aqui ele controla os
					    painéis da página, então segue o padrão de abas. */}
					{liberado && (
						<TabMenu
							className="mt-6 sm:mt-8"
							model={[...abasPainel]}
							activeIndex={indice}
							onTabChange={(evento) => setAba(abasPainel[evento.index]!.id)}
							pt={{
								menu: { role: 'tablist', 'aria-label': 'Seções do painel' },
								action: (opcoes) => ({
									role: 'tab',
									id: `aba-${opcoes?.context.item.id}`,
									'aria-selected': opcoes?.context.index === indice,
									'aria-controls': `painel-${opcoes?.context.item.id}`
								})
							}}
						/>
					)}
				</div>
			</header>
			<main
				id="conteudo"
				tabIndex={-1}
				className="mx-auto max-w-[1440px] px-[4%] pt-4 pb-10"
			>
				{acesso.estado === 'liberado' ? (
					<PainelIndicadores aba={aba} />
				) : (
					<TelaAcesso
						estado={acesso.estado}
						email={acesso.usuario?.email}
						sessaoExpirou={acesso.sessaoExpirou}
						onTentarNovamente={acesso.tentarNovamente}
					/>
				)}
				<Accordion className="mt-10 rounded-lg border border-panel-line bg-panel-surface px-4 py-3 sm:px-6">
					<AccordionTab header="Como interpretar os dados">
						<p className={notaLeitura}>
							A base de risco corresponde aos vínculos aluno-curso, descontados
							os falecidos. Um estudante em dois cursos representa dois
							vínculos. Os resultados refletem a base conectada e ajudam a
							descrever a evasão; não identificam, isoladamente, suas causas.
						</p>
						<p className={notaLeitura}>
							Município de oferta é o local do curso; município da sede é o da
							instituição. Em EaD, a sede não substitui um local de oferta
							ausente. As características institucionais podem representar mais
							de uma instituição.
						</p>
						<p className={notaLeitura}>
							A evolução compara censos anuais, sem acompanhar a trajetória de
							uma coorte. Lacunas indicam dados ou taxas indisponíveis, não
							zero. Valores negativos e sinalizações de qualidade são
							preservados em cada recorte.
						</p>
					</AccordionTab>
				</Accordion>
			</main>
			<footer className="bg-panel-green text-sm text-white/80">
				<div className="mx-auto flex max-w-[1440px] flex-wrap justify-between gap-4 px-[4%] py-5">
					<span>Projeto de conclusão de curso · Evasão MT</span>
					{import.meta.env.DEV && (
						<a className="text-white underline" href="/docs/">
							Documentação da API
						</a>
					)}
				</div>
			</footer>
		</>
	)
}
