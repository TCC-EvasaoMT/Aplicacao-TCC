import type { Resumo } from './api'

const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })
const percentual = new Intl.NumberFormat('pt-BR', {
	style: 'percent',
	maximumFractionDigits: 2
})
const formatar = (value: number | null, taxa = false) =>
	value === null ? 'Não disponível' : (taxa ? percentual : numero).format(value)

export function ResumoIndicadores({ resumo }: { resumo: Resumo }) {
	return (
		<>
			<div className="metrics">
				{[
					['Vínculos aluno–curso', resumo.totais.vinculos_total],
					['Matrículas', resumo.totais.matriculas_total],
					['Ingressantes', resumo.totais.ingressantes_total],
					['Concluintes', resumo.totais.concluintes_total]
				].map(([label, value]) => (
					<article className="metric" key={String(label)}>
						<h3>{label}</h3>
						<p className="metric-value">{formatar(value as number | null)}</p>
					</article>
				))}
			</div>
			<div className="rates">
				<article className="rate">
					<h3>Evasão do curso</h3>
					<p className="rate-value">
						{formatar(resumo.taxas.evasao_curso, true)}
					</p>
					<p>Desvinculados e transferidos, em relação à base de risco.</p>
				</article>
				<article className="rate">
					<h3>Evasão da instituição</h3>
					<p className="rate-value">
						{formatar(resumo.taxas.evasao_ies, true)}
					</p>
					<p>Desvinculados, em relação à base de risco.</p>
				</article>
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
