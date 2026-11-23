import type { Resumo } from './api'
import { variacaoTaxa, variacaoTotal, type Variacao } from './variacao'

const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })
const percentual = new Intl.NumberFormat('pt-BR', {
	style: 'percent',
	maximumFractionDigits: 2
})
const formatar = (value: number | null, taxa = false) =>
	value === null ? 'Não disponível' : (taxa ? percentual : numero).format(value)

// Linha de variação contra o ano anterior. Seta em texto, cor neutra: o painel
// não julga se a mudança é boa ou ruim.
function LinhaVariacao({
	variacao,
	ano
}: {
	variacao: Variacao | null | undefined
	ano: number
}) {
	if (variacao === undefined) return null
	if (variacao === null)
		return <p className="variation">sem comparação com {ano}</p>
	if (variacao.direcao === 'estavel')
		return <p className="variation">sem variação ante {ano}</p>
	const pontos = variacao.texto.endsWith(' p.p.')
	const valor = pontos ? variacao.texto.slice(0, -5) : variacao.texto
	return (
		<p className="variation">
			<span aria-hidden="true">{variacao.direcao === 'alta' ? '▲' : '▼'} </span>
			<span className="visually-hidden">
				{variacao.direcao === 'alta' ? 'Alta de ' : 'Queda de '}
			</span>
			{valor}
			{pontos && (
				<>
					{' '}
					<abbr title="pontos percentuais">p.p.</abbr>
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
			<div className="rates">
				<article className="rate">
					<h3>Evasão do curso</h3>
					<p className="rate-value">
						{formatar(resumo.taxas.evasao_curso, true)}
					</p>
					<LinhaVariacao variacao={taxaVar('evasao_curso')} ano={anoAnterior} />
					<p>Desvinculados e transferidos, em relação à base de risco.</p>
				</article>
				<article className="rate">
					<h3>Evasão da instituição</h3>
					<p className="rate-value">
						{formatar(resumo.taxas.evasao_ies, true)}
					</p>
					<LinhaVariacao variacao={taxaVar('evasao_ies')} ano={anoAnterior} />
					<p>Desvinculados, em relação à base de risco.</p>
				</article>
			</div>
			<div className="metrics">
				{(
					[
						['Vínculos aluno-curso', 'vinculos_total'],
						['Matrículas', 'matriculas_total'],
						['Ingressantes', 'ingressantes_total'],
						['Concluintes', 'concluintes_total']
					] as const
				).map(([rotulo, chave]) => (
					<article className="metric" key={chave}>
						<h3>{rotulo}</h3>
						<p className="metric-value">{formatar(resumo.totais[chave])}</p>
						<LinhaVariacao variacao={totalVar(chave)} ano={anoAnterior} />
					</article>
				))}
			</div>
			{(resumo.qualidade.flag_valor_negativo ||
				resumo.qualidade.flag_grupo_pequeno ||
				resumo.qualidade.dados_incompletos) && (
				<div className="quality" role="note">
					<h3>Cuidados na leitura</h3>
					{resumo.qualidade.flag_valor_negativo && (
						<p>
							O recorte contém valores negativos sinalizados na origem. Eles
							foram preservados.
						</p>
					)}
					{resumo.qualidade.flag_grupo_pequeno && (
						<p>
							A base tem menos de 30 vínculos. As taxas devem ser interpretadas
							com cautela.
						</p>
					)}
					{resumo.qualidade.dados_incompletos && (
						<p>
							Há medidas incompletas. Os totais afetados aparecem como não
							disponíveis.
						</p>
					)}
				</div>
			)}
		</>
	)
}
