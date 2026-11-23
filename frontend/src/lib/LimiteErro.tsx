import { Component, type ReactNode } from 'react'

interface Props {
	mensagem: string
	children: ReactNode
}

// Isola falhas de renderização ou de carregamento de partes lazy (gráficos),
// para que o restante do painel continue utilizável.
export class LimiteErro extends Component<Props, { falhou: boolean }> {
	state = { falhou: false }

	static getDerivedStateFromError() {
		return { falhou: true }
	}

	render() {
		if (!this.state.falhou) return this.props.children
		return (
			<div className="alert alert-danger" role="alert">
				<p>{this.props.mensagem}</p>
				<button
					className="btn btn-outline-success btn-sm"
					type="button"
					onClick={() => window.location.reload()}
				>
					Recarregar página
				</button>
			</div>
		)
	}
}
