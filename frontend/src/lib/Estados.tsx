// Estados de carregamento compartilhados pelos painéis.
export function Carregando({ texto }: { texto: string }) {
	return (
		<p className="state state-loading">
			<span className="spinner-border spinner-border-sm" aria-hidden="true" />
			{texto}
		</p>
	)
}

export function GraficoCarregando() {
	return <div className="chart-loading">Carregando gráfico…</div>
}
