import { useEffect, useRef, useState } from 'react'
import { Sidebar } from 'primereact/sidebar'
import { Ajuda } from '../../lib/ui'
import { CamposLogin } from './CamposLogin'
import { encerrarSessao } from './sessao'
import { useSessao } from './useSessao'
import { usePaginaInerte } from './usePaginaInerte'
import { AlterarSenha } from './AlterarSenha'

// Nativo, para não disputar cores com o tema do Button do PrimeReact.
const botaoCabecalho =
	'inline-flex min-h-10 cursor-pointer items-center rounded border border-white/60 px-3 py-1.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-white/10 focus-visible:outline-white disabled:cursor-default disabled:opacity-60 motion-reduce:transition-none'

export function AcessoAdministrativo() {
	const { usuario, verificando } = useSessao()
	const [aberto, setAberto] = useState(false)
	const [trocandoSenha, setTrocandoSenha] = useState(false)
	const [saindo, setSaindo] = useState(false)
	const botao = useRef<HTMLButtonElement>(null)
	const restaurado = useRef(false)
	// Entrar/Sair troca o botão focado; devolve o foco perdido, exceto ao abrir a página.
	useEffect(() => {
		if (verificando) return
		if (!restaurado.current) {
			restaurado.current = true
			return
		}
		if (document.activeElement === document.body) botao.current?.focus()
	}, [usuario, verificando])
	if (verificando) return null
	if (usuario) {
		return (
			<div className="flex min-w-0 items-center gap-3 text-sm">
				<span className="hidden truncate text-white/80 lg:inline">
					{usuario.email}
				</span>
				<button
					type="button"
					className={botaoCabecalho}
					aria-haspopup="dialog"
					aria-label="Alterar senha"
					onClick={() => setTrocandoSenha(true)}
				>
					<span className="sm:hidden">Senha</span>
					<span className="hidden sm:inline">Alterar senha</span>
				</button>
				<AlterarSenha
					aberto={trocandoSenha}
					onFechar={() => setTrocandoSenha(false)}
				/>
				<button
					ref={botao}
					type="button"
					className={botaoCabecalho}
					disabled={saindo}
					onClick={() => {
						setSaindo(true)
						void encerrarSessao()
							.catch(() => {})
							.finally(() => setSaindo(false))
					}}
				>
					Sair
				</button>
			</div>
		)
	}
	return (
		<>
			<button
				ref={botao}
				type="button"
				className={botaoCabecalho}
				aria-haspopup="dialog"
				onClick={() => setAberto(true)}
			>
				Entrar
			</button>
			<FormularioLogin aberto={aberto} onFechar={() => setAberto(false)} />
		</>
	)
}

function FormularioLogin({
	aberto,
	onFechar
}: {
	aberto: boolean
	onFechar: () => void
}) {
	usePaginaInerte(aberto)
	return (
		<Sidebar
			visible={aberto}
			position="right"
			blockScroll
			onShow={() => document.getElementById('login-email')?.focus()}
			aria-labelledby="login-titulo"
			header={
				<h2 id="login-titulo" className="text-white">
					Acesso administrativo
				</h2>
			}
			onHide={onFechar}
		>
			<Ajuda className="mt-0">
				Para equipes autorizadas a administrar a atualização dos dados. O painel
				continua disponível sem login.
			</Ajuda>
			<CamposLogin prefixo="login" onEntrou={onFechar} />
		</Sidebar>
	)
}
