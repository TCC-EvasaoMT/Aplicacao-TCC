export interface Catalogo {
  anos: number[];
}

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

export async function consultar<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Não foi possível carregar os dados. Tente novamente.');
  return response.json() as Promise<T>;
}
