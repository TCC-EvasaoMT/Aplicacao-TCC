import { useRef, useState, type FormEvent } from 'react'
import { Button } from 'primereact/button'
import { InputText } from 'primereact/inputtext'
import { Sidebar } from 'primereact/sidebar'
import { ErroHttp } from '../../lib/http'
import { Ajuda, classes } from '../../lib/ui'
import {
	LIMITES_SENHA,
	MAX_UTF16_SENHA,
	mensagemTrocaSenha,
	validarNovaSenha,
	type ErroNovaSenha
} from './regras'
import { alterarSenha } from './sessao'
import { usePaginaInerte } from './usePaginaInerte'

type Campo = 'atual' | ErroNovaSenha['campo']

export function AlterarSenha({
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
			onShow={() => document.getElementById('senha-atual')?.focus()}
			aria-labelledby="senha-titulo"
			header={
				<h2 id="senha-titulo" className="text-white">
					Alterar senha
				</h2>
			}
			onHide={onFechar}
		>
			<Formulario />
		</Sidebar>
	)
}

function Formulario() {
	const [valores, setValores] = useState({
		atual: '',
		nova: '',
		confirmacao: ''
	})
	const [erro, setErro] = useState<{ campo: Campo | null; mensagem: string }>()
	const [sucesso, setSucesso] = useState('')
	const [enviando, setEnviando] = useState(false)
	const campos = {
		atual: useRef<HTMLInputElement>(null),
		nova: useRef<HTMLInputElement>(null),
		confirmacao: useRef<HTMLInputElement>(null)
	}
	function falhar(campo: Campo | null, mensagem: string) {
		setErro({ campo, mensagem })
		campos[campo ?? 'atual'].current?.focus()
	}
	async function enviar(evento: FormEvent) {
		evento.preventDefault()
		setSucesso('')
		const invalida = validarNovaSenha(
			valores.atual,
			valores.nova,
			valores.confirmacao
		)
		if (invalida) return falhar(invalida.campo, invalida.mensagem)
		setErro(undefined)
		setEnviando(true)
		try {
			await alterarSenha(valores.atual, valores.nova)
			setValores({ atual: '', nova: '', confirmacao: '' })
			setSucesso(
				'Senha alterada. As outras sessões desta conta foram encerradas.'
			)
		} catch (falha) {
			const status = falha instanceof ErroHttp ? falha.status : null
			setValores((anteriores) => ({ ...anteriores, atual: '' }))
			falhar(status === 422 ? 'atual' : null, mensagemTrocaSenha(status))
		} finally {
			setEnviando(false)
		}
	}
	const campo = (
		id: Campo,
		rotulo: string,
		autoComplete: string,
		ajuda?: string
	) => {
		const invalido = !!erro && (erro.campo === id || erro.campo === null)
		const descricoes = [
			ajuda && `senha-${id}-ajuda`,
			invalido && 'senha-erro'
		].filter(Boolean)
		return (
			<div>
				<label className={classes.rotulo} htmlFor={`senha-${id}`}>
					{rotulo}
				</label>
				<InputText
					id={`senha-${id}`}
					ref={campos[id]}
					type="password"
					autoComplete={autoComplete}
					required
					maxLength={MAX_UTF16_SENHA}
					value={valores[id]}
					invalid={invalido}
					aria-invalid={invalido}
					aria-describedby={descricoes.join(' ') || undefined}
					onChange={(evento) =>
						setValores((anteriores) => ({
							...anteriores,
							[id]: evento.target.value
						}))
					}
				/>
				{ajuda && (
					<Ajuda id={`senha-${id}-ajuda`} className="mt-1 mb-0">
						{ajuda}
					</Ajuda>
				)}
			</div>
		)
	}
	return (
		<>
			<Ajuda className="mt-0">
				Ao alterar, as outras sessões desta conta são encerradas. Esta continua
				ativa.
			</Ajuda>
			<form className="mt-4 grid gap-4" onSubmit={enviar}>
				{campo('atual', 'Senha atual', 'current-password')}
				{campo(
					'nova',
					'Nova senha',
					'new-password',
					`Entre ${LIMITES_SENHA.minimo} e ${LIMITES_SENHA.maximo} caracteres. Uma frase longa é mais fácil de lembrar e mais segura.`
				)}
				{campo('confirmacao', 'Confirme a nova senha', 'new-password')}
				<p
					id="senha-erro"
					role="alert"
					className="m-0 text-sm font-semibold text-panel-danger empty:hidden"
				>
					{erro?.mensagem}
				</p>
				<p
					role="status"
					className="m-0 text-sm font-semibold text-panel-green empty:hidden"
				>
					{sucesso}
				</p>
				<Button type="submit" label="Alterar senha" loading={enviando} />
			</form>
		</>
	)
}
