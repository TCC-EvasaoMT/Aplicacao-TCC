import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from 'primereact/button'
import { InputText } from 'primereact/inputtext'
import { Sidebar } from 'primereact/sidebar'
import { ErroHttp } from '../../lib/http'
import { Ajuda, classes } from '../../lib/ui'
import { MAX_UTF16_SENHA_ATUAL, mensagemLogin } from './regras'
import { encerrarSessao, iniciarSessao } from './sessao'
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
	const [email, setEmail] = useState('')
	const [senha, setSenha] = useState('')
	const [erro, setErro] = useState('')
	const [enviando, setEnviando] = useState(false)
	const campoEmail = useRef<HTMLInputElement>(null)
	usePaginaInerte(aberto)
	useEffect(() => {
		if (aberto) return
		setSenha('')
		setErro('')
	}, [aberto])
	async function enviar(evento: FormEvent) {
		evento.preventDefault()
		setEnviando(true)
		setErro('')
		try {
			await iniciarSessao(email.trim(), senha)
			onFechar()
		} catch (falha) {
			setErro(mensagemLogin(falha instanceof ErroHttp ? falha.status : null))
			setSenha('')
			campoEmail.current?.focus()
		} finally {
			setEnviando(false)
		}
	}
	return (
		<Sidebar
			visible={aberto}
			position="right"
			blockScroll
			onShow={() => campoEmail.current?.focus()}
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
			<form className="mt-4 grid gap-4" onSubmit={enviar}>
				<div>
					<label className={classes.rotulo} htmlFor="login-email">
						E-mail
					</label>
					<InputText
						id="login-email"
						ref={campoEmail}
						type="email"
						autoComplete="username"
						required
						maxLength={254}
						value={email}
						invalid={!!erro}
						aria-invalid={!!erro}
						aria-describedby={erro ? 'login-erro' : undefined}
						onChange={(evento) => setEmail(evento.target.value)}
					/>
				</div>
				<div>
					<label className={classes.rotulo} htmlFor="login-senha">
						Senha
					</label>
					<InputText
						id="login-senha"
						type="password"
						autoComplete="current-password"
						required
						maxLength={MAX_UTF16_SENHA_ATUAL}
						value={senha}
						invalid={!!erro}
						aria-invalid={!!erro}
						aria-describedby={erro ? 'login-erro' : undefined}
						onChange={(evento) => setSenha(evento.target.value)}
					/>
				</div>
				<p
					id="login-erro"
					role="alert"
					className="m-0 text-sm font-semibold text-panel-danger empty:hidden"
				>
					{erro}
				</p>
				<Button type="submit" label="Entrar" loading={enviando} />
			</form>
		</Sidebar>
	)
}
