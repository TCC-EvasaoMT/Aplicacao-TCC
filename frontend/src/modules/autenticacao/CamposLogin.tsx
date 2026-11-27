import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from 'primereact/button'
import { InputText } from 'primereact/inputtext'
import { ErroHttp } from '../../lib/http'
import { classes } from '../../lib/ui'
import { MAX_UTF16_SENHA_ATUAL, mensagemLogin } from './regras'
import { iniciarSessao } from './sessao'

// Formulário de login usado na gaveta do cabeçalho e na tela de acesso do
// painel restrito. prefixo distingue os ids quando as duas existem.
export function CamposLogin({
	prefixo,
	focar = false,
	onEntrou
}: {
	prefixo: string
	focar?: boolean
	onEntrou?: () => void
}) {
	const [email, setEmail] = useState('')
	const [senha, setSenha] = useState('')
	const [erro, setErro] = useState('')
	const [enviando, setEnviando] = useState(false)
	const campoEmail = useRef<HTMLInputElement>(null)
	useEffect(() => {
		if (focar) campoEmail.current?.focus()
	}, [focar])
	async function enviar(evento: FormEvent) {
		evento.preventDefault()
		setEnviando(true)
		setErro('')
		try {
			await iniciarSessao(email.trim(), senha)
			onEntrou?.()
		} catch (falha) {
			setErro(mensagemLogin(falha instanceof ErroHttp ? falha.status : null))
			setSenha('')
			campoEmail.current?.focus()
		} finally {
			setEnviando(false)
		}
	}
	const idErro = `${prefixo}-erro`
	return (
		<form className="mt-4 grid gap-4" onSubmit={enviar}>
			<div>
				<label className={classes.rotulo} htmlFor={`${prefixo}-email`}>
					E-mail
				</label>
				<InputText
					id={`${prefixo}-email`}
					ref={campoEmail}
					type="email"
					autoComplete="username"
					required
					maxLength={254}
					value={email}
					invalid={!!erro}
					aria-invalid={!!erro}
					aria-describedby={erro ? idErro : undefined}
					onChange={(evento) => setEmail(evento.target.value)}
				/>
			</div>
			<div>
				<label className={classes.rotulo} htmlFor={`${prefixo}-senha`}>
					Senha
				</label>
				<InputText
					id={`${prefixo}-senha`}
					type="password"
					autoComplete="current-password"
					required
					maxLength={MAX_UTF16_SENHA_ATUAL}
					value={senha}
					invalid={!!erro}
					aria-invalid={!!erro}
					aria-describedby={erro ? idErro : undefined}
					onChange={(evento) => setSenha(evento.target.value)}
				/>
			</div>
			<p
				id={idErro}
				role="alert"
				className="m-0 text-sm font-semibold text-panel-danger empty:hidden"
			>
				{erro}
			</p>
			<Button type="submit" label="Entrar" loading={enviando} />
		</form>
	)
}
