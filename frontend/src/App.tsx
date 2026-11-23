import { PainelIndicadores } from './modules/indicadores'

export function App() {
	return (
		<div className="app">
			<a className="skip-link" href="#conteudo">
				Ir para o conteúdo
			</a>
			<header className="topbar">
				<a className="brand" href="/">
					<span className="brand-mark" aria-hidden="true">
						MT
					</span>{' '}
					Evasão MT
				</a>
				<span className="project-label">Ensino superior público</span>
			</header>
			<main id="conteudo" tabIndex={-1}>
				<div className="heading">
					<div>
						<h1>Evasão no ensino superior</h1>
						<p className="intro">
							Instituições públicas com sede em Mato Grosso.
						</p>
					</div>
				</div>
				<PainelIndicadores />
				<details className="reading-note">
					<summary>Como interpretar os dados</summary>
					<p>
						A base de risco corresponde aos vínculos aluno-curso, descontados os
						falecidos. Um estudante em dois cursos representa dois vínculos. Os
						resultados refletem a base conectada e ajudam a descrever a evasão;
						não identificam, isoladamente, suas causas.
					</p>
					<p>
						Município de oferta é o local do curso; município da sede é o da
						instituição. Em EaD, a sede não substitui um local de oferta
						ausente. As características institucionais podem representar mais de
						uma instituição.
					</p>
					<p>
						A evolução compara censos anuais, sem acompanhar a trajetória de uma
						coorte. Lacunas indicam dados ou taxas indisponíveis, não zero.
						Valores negativos e sinalizações de qualidade são preservados em
						cada recorte.
					</p>
				</details>
			</main>
			<footer>
				<span>Projeto de conclusão de curso · Evasão MT</span>
				{import.meta.env.DEV && <a href="/docs/">Documentação da API</a>}
			</footer>
		</div>
	)
}
