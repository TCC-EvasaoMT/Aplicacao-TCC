import { consultar } from '../../lib/http';

export interface Resumo {
  totais: {
    vinculos_total: number | null;
    matriculas_total: number | null;
    ingressantes_total: number | null;
    concluintes_total: number | null;
  };
  taxas: { evasao_curso: number | null; evasao_ies: number | null };
  qualidade: {
    sem_dados: boolean;
    dados_incompletos: boolean;
    flag_valor_negativo: boolean;
    flag_grupo_pequeno: boolean | null;
  };
}


export function consultarResumo(query: string, signal: AbortSignal) {
  return consultar<Resumo>(`/api/v1/indicadores/resumo?${query}`, signal);
}
