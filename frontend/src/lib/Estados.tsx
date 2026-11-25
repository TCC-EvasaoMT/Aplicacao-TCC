import { ProgressSpinner } from 'primereact/progressspinner'
import { classes, cx } from './ui'

// Estados de carregamento compartilhados pelos painéis.
export function Carregando({ texto }: { texto: string }) {
	return (
		<div
			className={cx(classes.estado, 'flex items-center gap-2 text-panel-muted')}
		>
			<ProgressSpinner aria-hidden="true" strokeWidth="6" />
			{texto}
		</div>
	)
}

// Reserva a altura do gráfico enquanto o chunk do Recharts carrega.
export function GraficoCarregando() {
	return (
		<div className="my-6 flex min-h-[360px] items-center justify-center rounded-lg border border-dashed border-panel-line text-panel-muted">
			Carregando gráfico…
		</div>
	)
}
