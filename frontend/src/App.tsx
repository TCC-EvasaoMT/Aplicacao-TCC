import { Accordion, AccordionTab } from 'primereact/accordion'
import { PainelIndicadores } from './modules/indicadores'

const notaLeitura = 'mt-3 max-w-[78ch] text-sm text-panel-muted'

export function App() {
	return (
		<div className="mx-auto max-w-[1440px]">
			<a
				className="fixed top-2 left-4 z-50 -translate-y-[150%] bg-panel-green px-4 py-3 text-white focus:translate-y-0"
				href="#conteudo"
			>
				Ir para o conteúdo
			</a>
			<header className="flex min-h-16 items-center justify-between gap-4 border-b border-panel-line px-[4%] py-3">
				<a
					className="inline-flex items-center gap-3 text-xl font-bold no-underline"
					href="/"
				>
					<span
						className="rounded bg-panel-green p-2 text-base leading-none text-white"
						aria-hidden="true"
					>
						MT
					</span>{' '}
					Evasão MT
				</a>
				<span className="hidden text-sm text-panel-muted sm:inline">
					Ensino superior público
				</span>
			</header>
			<main id="conteudo" tabIndex={-1} className="px-[4%] pt-6 pb-8 sm:pt-8">
				<div className="mb-6">
					<h1 className="mb-2">Evasão no ensino superior</h1>
					<p className="max-w-[75ch] text-panel-muted">
						Instituições públicas com sede em Mato Grosso.
					</p>
				</div>
				<PainelIndicadores />
				<Accordion className="mt-6 border-t border-panel-line pt-4">
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
			<footer className="flex flex-wrap justify-between gap-4 border-t border-panel-line px-[4%] py-4 text-sm text-panel-muted">
				<span>Projeto de conclusão de curso · Evasão MT</span>
				{import.meta.env.DEV && (
					<a className="underline" href="/docs/">
						Documentação da API
					</a>
				)}
			</footer>
		</div>
	)
}
