import { PainelIndicadores } from './modules/indicadores';

export function App() {
  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Evasão MT, início">
          <span className="brand-mark">MT</span> Evasão MT
        </a>
        <span className="project-label">Ensino superior público</span>
      </header>
      <main id="conteudo">
        <div className="heading">
          <div>
            <p className="eyebrow">Panorama educacional</p>
            <h1>Acompanhar para compreender.</h1>
            <p className="intro">
              Indicadores de evasão dos cursos de instituições públicas com sede em Mato Grosso.
            </p>
          </div>
        </div>
        <PainelIndicadores />
        <aside className="reading-note">
          <h2>Como ler os indicadores</h2>
          <p>
            A base de risco corresponde aos vínculos aluno–curso, descontados os falecidos. Um
            estudante em dois cursos representa dois vínculos. Os resultados refletem a base
            conectada e ajudam a descrever a evasão; não identificam, isoladamente, suas causas.
          </p>
        </aside>
      </main>
      <footer>
        <span>Projeto de conclusão de curso · Evasão MT</span>
        {import.meta.env.DEV && <a href="/docs/">Documentação da API</a>}
      </footer>
    </div>
  );
}
