import { useState } from 'react'
import { Button } from 'primereact/button'
import { Carregando } from '../../lib/Estados'
import { Ajuda, Aviso, classes, cx } from '../../lib/ui'
import { CamposLogin } from './CamposLogin'
import type { EstadoAcesso } from './regras'
import { encerrarSessao } from './sessao'

// Tela mostrada no lugar das abas enquanto o painel restrito não está liberado.
export function TelaAcesso({
	estado,
	email,
	sessaoExpirou,
	onTentarNovamente
}: {
	estado: Exclude<EstadoAcesso, 'liberado'>
	email?: string
	sessaoExpirou: boolean
	onTentarNovamente: () => void
}) {
	const [saindo, setSaindo] = useState(false)
	if (estado === 'carregando') return <Carregando texto="Verificando acesso…" />
	return (
		<section
			className={cx(classes.secao, 'mx-auto max-w-[480px]')}
			aria-labelledby="acesso-titulo"
		>
			{estado === 'erro' && (
				<>
					<h2 id="acesso-titulo" className={classes.titulo}>
						Não foi possível verificar o acesso
					</h2>
					<Ajuda>
						O servidor não respondeu. Confira a conexão e tente novamente.
					</Ajuda>
					<Button
						className="mt-4"
						label="Tentar novamente"
						outlined
						onClick={onTentarNovamente}
					/>
				</>
			)}
			{estado === 'login' && (
				<>
					<h2 id="acesso-titulo" className={classes.titulo}>
						Entre para consultar o painel
					</h2>
					<Ajuda>
						Neste servidor, o painel é restrito a contas autorizadas. Peça
						acesso a quem administra o painel.
					</Ajuda>
					{sessaoExpirou && (
						<Aviso className="mt-3">
							<p>Sua sessão terminou. Entre novamente para continuar.</p>
						</Aviso>
					)}
					<CamposLogin prefixo="acesso" focar />
				</>
			)}
			{estado === 'sem_permissao' && (
				<>
					<h2 id="acesso-titulo" className={classes.titulo}>
						Conta sem acesso ao painel
					</h2>
					<Ajuda>
						A conta {email} entrou, mas não tem permissão para consultar o
						painel. Peça a permissão a quem administra o painel ou entre com
						outra conta.
					</Ajuda>
					<Button
						className="mt-4"
						label="Sair"
						outlined
						loading={saindo}
						onClick={() => {
							setSaindo(true)
							void encerrarSessao()
								.catch(() => {})
								.finally(() => setSaindo(false))
						}}
					/>
				</>
			)}
		</section>
	)
}
