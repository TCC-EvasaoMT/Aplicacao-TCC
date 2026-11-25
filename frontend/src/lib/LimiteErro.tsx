import { Component, type ReactNode } from 'react'
import { Button } from 'primereact/button'
import { Message } from 'primereact/message'

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
			<Message
				severity="error"
				content={
					<>
						<p className="mb-3">{this.props.mensagem}</p>
						<Button
							label="Recarregar página"
							outlined
							size="small"
							onClick={() => window.location.reload()}
						/>
					</>
				}
			/>
		)
	}
}
