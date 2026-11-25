import { Aviso, cx } from '../../lib/ui'
import type { Resumo } from './api'
import { variacaoTaxa, variacaoTotal, type Variacao } from './variacao'

const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })
const percentual = new Intl.NumberFormat('pt-BR', {
	style: 'percent',
	maximumFractionDigits: 2
})
const formatar = (value: number | null, taxa = false) =>
	value === null ? 'Não disponível' : (taxa ? percentual : numero).format(value)
const valorDestacado = 'font-semibold leading-tight tabular-nums wrap-anywhere'

// Linha de variação contra o ano anterior. Seta em texto, cor neutra: o painel
// não julga se a mudança é boa ou ruim.
function LinhaVariacao({
	variacao,
	ano,
	className
}: {
	variacao: Variacao | null | undefined
	ano: number
	className: string
}) {
	if (variacao === undefined) return null
	const classe = cx('text-panel-muted tabular-nums', className)
	if (variacao === null)
		return <p className={classe}>sem comparação com {ano}</p>
	if (variacao.direcao === 'estavel')
		return <p className={classe}>sem variação ante {ano}</p>
	const pontos = variacao.unidade === 'pp'
	const valor = variacao.texto
	return (
		<p className={classe}>
			<span aria-hidden="true">{variacao.direcao === 'alta' ? '▲' : '▼'} </span>
			<span className="sr-only">
				{variacao.direcao === 'alta' ? 'Alta de ' : 'Queda de '}
			</span>
			{valor}
			{pontos && (
				<>
					{' '}
					<abbr className="cursor-help no-underline" title="pontos percentuais">
						p.p.
					</abbr>
				</>
			)}{' '}
			ante {ano}
		</p>
	)
}

interface Props {
	resumo: Resumo
	// Resumo do ano anterior com os mesmos filtros; undefined enquanto não há
	// consulta, null quando ela falhou.
	anterior?: Resumo | null
	ano: number
}

const taxas = [
	{
		chave: 'evasao_curso',
		titulo: 'Evasão do curso',
		descricao: 'Desvinculados e transferidos, em relação à base de risco.',
		cor: 'border-t-panel-green bg-panel-chip',
		valor: 'text-panel-green'
	},
	{
		chave: 'evasao_ies',
		titulo: 'Evasão da instituição',
		descricao: 'Desvinculados, em relação à base de risco.',
		cor: 'border-t-panel-secondary bg-panel-secondary-soft',
		valor: 'text-panel-secondary'
	}
] as const

const totais = [
	['Vínculos aluno-curso', 'vinculos_total'],
	['Matrículas', 'matriculas_total'],
	['Ingressantes', 'ingressantes_total'],
	['Concluintes', 'concluintes_total']
] as const

export function ResumoIndicadores({ resumo, anterior, ano }: Props) {
	const anoAnterior = ano - 1
	const taxaVar = (chave: keyof Resumo['taxas']) =>
		anterior === undefined
			? undefined
			: variacaoTaxa(resumo.taxas[chave], anterior?.taxas[chave] ?? null)
	const totalVar = (chave: keyof Resumo['totais']) =>
		anterior === undefined
			? undefined
			: variacaoTotal(resumo.totais[chave], anterior?.totais[chave] ?? null)
	return (
		<>
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
				{taxas.map((taxa) => (
					<article
						className={cx(
							'rounded-b-lg border border-t-4 border-panel-line p-4 shadow-[0_1px_2px_rgb(23_46_41/6%)] sm:px-6 sm:pt-4 sm:pb-5',
							taxa.cor
						)}
						key={taxa.chave}
					>
						<h3>{taxa.titulo}</h3>
						<p
							className={cx(
								valorDestacado,
								taxa.valor,
								'mt-2 mb-1 text-[clamp(2.25rem,4vw,2.75rem)] tracking-[-0.01em]'
							)}
						>
							{formatar(resumo.taxas[taxa.chave], true)}
						</p>
						<LinhaVariacao
							variacao={taxaVar(taxa.chave)}
							ano={anoAnterior}
							className="mb-2 text-sm"
						/>
						<p className="text-sm text-panel-muted">{taxa.descricao}</p>
					</article>
				))}
			</div>
			<div className="mt-4 grid grid-cols-2 overflow-hidden rounded-lg border border-panel-line bg-panel-surface md:grid-cols-4">
				{totais.map(([rotulo, chave], indice) => (
					<article
						className={cx(
							'border-panel-line p-3 sm:px-6 sm:py-4',
							indice % 2 === 1 && 'border-l',
							indice === 2 && 'md:border-l',
							indice >= 2 && 'border-t md:border-t-0'
						)}
						key={chave}
					>
						<h3 className="text-panel-muted">{rotulo}</h3>
						<p className={cx(valorDestacado, 'mt-2 text-2xl')}>
							{formatar(resumo.totais[chave])}
						</p>
						<LinhaVariacao
							variacao={totalVar(chave)}
							ano={anoAnterior}
							className="mt-1 text-[0.8125rem]"
						/>
					</article>
				))}
			</div>
			{(resumo.qualidade.flag_valor_negativo ||
				resumo.qualidade.flag_grupo_pequeno ||
				resumo.qualidade.dados_incompletos) && (
				<Aviso role="note">
					<h3>Cuidados na leitura</h3>
					{resumo.qualidade.flag_valor_negativo && (
						<p className="mt-2 text-sm text-panel-warning-ink">
							O recorte contém valores negativos sinalizados na origem. Eles
							foram preservados.
						</p>
					)}
					{resumo.qualidade.flag_grupo_pequeno && (
						<p className="mt-2 text-sm text-panel-warning-ink">
							A base tem menos de 30 vínculos. As taxas devem ser interpretadas
							com cautela.
						</p>
					)}
					{resumo.qualidade.dados_incompletos && (
						<p className="mt-2 text-sm text-panel-warning-ink">
							Há medidas incompletas. Os totais afetados aparecem como não
							disponíveis.
						</p>
					)}
				</Aviso>
			)}
		</>
	)
}
