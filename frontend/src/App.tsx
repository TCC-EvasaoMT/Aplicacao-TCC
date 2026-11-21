import { useEffect, useState } from 'react';
import { consultar, type Catalogo, type Resumo } from './indicadores/api';

const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const percentual = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 2 });
const formatar = (value: number | null, taxa = false) =>
  value === null ? 'Não disponível' : (taxa ? percentual : numero).format(value);

export function App() {
  const [anos, setAnos] = useState<number[]>([]);
  const [ano, setAno] = useState('');
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [carregandoCatalogo, setCarregandoCatalogo] = useState(true);
  const [carregandoResumo, setCarregandoResumo] = useState(false);
  const [erroCatalogo, setErroCatalogo] = useState('');
  const [erroResumo, setErroResumo] = useState('');
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setCarregandoCatalogo(true);
    setErroCatalogo('');
    setAnos([]);
    setAno('');
    setResumo(null);
    consultar<Catalogo>('/api/v1/filtros', controller.signal)
      .then(catalogo => {
        if (controller.signal.aborted) return;
        setAnos(catalogo.anos);
        setAno(catalogo.anos[0]?.toString() ?? '');
      })
      .catch(() => { if (!controller.signal.aborted) setErroCatalogo('Os dados estão indisponíveis no momento.'); })
      .finally(() => { if (!controller.signal.aborted) setCarregandoCatalogo(false); });
    return () => controller.abort();
  }, [tentativa]);

  useEffect(() => {
    setResumo(null);
    setErroResumo('');
    if (!ano) {
      setCarregandoResumo(false);
      return;
    }
    const controller = new AbortController();
    setCarregandoResumo(true);
    consultar<Resumo>(`/api/v1/indicadores/resumo?${new URLSearchParams({ ano })}`, controller.signal)
      .then(dados => { if (!controller.signal.aborted) setResumo(dados); })
      .catch(() => { if (!controller.signal.aborted) setErroResumo('Não foi possível carregar o resumo deste ano.'); })
      .finally(() => { if (!controller.signal.aborted) setCarregandoResumo(false); });
    return () => controller.abort();
  }, [ano, tentativa]);

  const carregando = carregandoCatalogo || carregandoResumo;
  const erro = erroCatalogo || erroResumo;
  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Evasão MT, início"><span className="brand-mark">MT</span> Evasão MT</a>
        <span className="project-label">Ensino superior público</span>
      </header>
      <main id="conteudo">
        <div className="heading">
          <div>
            <p className="eyebrow">Panorama educacional</p>
            <h1>Acompanhar para compreender.</h1>
            <p className="intro">Indicadores de evasão dos cursos de instituições públicas com sede em Mato Grosso.</p>
          </div>
          <div className="year-filter">
            <label htmlFor="ano">Ano do censo</label>
            <select id="ano" value={ano} disabled={!anos.length || carregandoCatalogo} onChange={event => setAno(event.target.value)}>
              {!anos.length && <option value="">{carregandoCatalogo ? 'Carregando…' : 'Sem anos disponíveis'}</option>}
              {anos.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
        </div>

        <section aria-labelledby="resumo-titulo" aria-busy={carregando}>
          <div className="section-heading">
            <h2 id="resumo-titulo">Resumo do período</h2>
            <button className="refresh" disabled={carregando} onClick={() => setTentativa(value => value + 1)}>Atualizar dados</button>
          </div>
          <div aria-live="polite">
            {carregando && <p className="state">Carregando indicadores…</p>}
            {!carregando && erro && <p className="state error" role="alert">{erro} Use “Atualizar dados” para tentar novamente.</p>}
            {!carregando && !erro && !anos.length && <p className="state">Nenhum ano está disponível na base conectada.</p>}
            {!carregando && !erro && resumo?.qualidade.sem_dados && <p className="state">Não há dados de alunos disponíveis para {ano}.</p>}
          </div>

          {!carregando && !erro && resumo && !resumo.qualidade.sem_dados && <>
            <div className="metrics">
              {[
                ['Vínculos aluno–curso', resumo.totais.vinculos_total],
                ['Matrículas', resumo.totais.matriculas_total],
                ['Ingressantes', resumo.totais.ingressantes_total],
                ['Concluintes', resumo.totais.concluintes_total],
              ].map(([label, value]) => <article className="metric" key={String(label)}>
                <h3>{label}</h3><p className="metric-value">{formatar(value as number | null)}</p>
              </article>)}
            </div>
            <div className="rates">
              <article className="rate">
                <h3>Evasão do curso</h3>
                <p className="rate-value">{formatar(resumo.taxas.evasao_curso, true)}</p>
                <p>Desvinculados e transferidos, em relação à base de risco.</p>
              </article>
              <article className="rate">
                <h3>Evasão da instituição</h3>
                <p className="rate-value">{formatar(resumo.taxas.evasao_ies, true)}</p>
                <p>Desvinculados, em relação à base de risco.</p>
              </article>
            </div>
            {(resumo.qualidade.flag_valor_negativo || resumo.qualidade.flag_grupo_pequeno || resumo.qualidade.dados_incompletos) &&
              <div className="quality" role="note">
                <h3>Cuidados na leitura</h3>
                {resumo.qualidade.flag_valor_negativo && <p>O recorte contém valores negativos sinalizados na origem. Eles foram preservados.</p>}
                {resumo.qualidade.flag_grupo_pequeno && <p>A base tem menos de 30 vínculos. As taxas devem ser interpretadas com cautela.</p>}
                {resumo.qualidade.dados_incompletos && <p>Há medidas incompletas. Os totais afetados aparecem como não disponíveis.</p>}
              </div>}
          </>}
        </section>

        <aside className="reading-note">
          <h2>Como ler os indicadores</h2>
          <p>A base de risco corresponde aos vínculos aluno–curso, descontados os falecidos. Um estudante em dois cursos representa dois vínculos. Os resultados refletem a base conectada e ajudam a descrever a evasão; não identificam, isoladamente, suas causas.</p>
        </aside>
      </main>
      <footer><span>Projeto de conclusão de curso · Evasão MT</span>{import.meta.env.DEV && <a href="/docs/">Documentação da API</a>}</footer>
    </div>
  );
}
