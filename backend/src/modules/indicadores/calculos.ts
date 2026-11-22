export const medidas = [
  'vinculos_total',
  'ingressantes_total',
  'matriculas_total',
  'concluintes_total',
  'alunos_cursando',
  'alunos_desvinculados',
  'alunos_transferidos',
  'alunos_matricula_trancada',
  'alunos_falecidos',
] as const;

export type Medida = (typeof medidas)[number];
export type Totais = Record<Medida, number | null>;
export type Agregado = Record<Medida, string | null> & {
  registros_com_alunos: number;
  registros_sem_alunos: number;
  flag_valor_negativo: boolean | null;
  dados_incompletos: boolean | null;
};

export function calcularResumo(agregado: Agregado) {
  const totais = Object.fromEntries(
    medidas.map((medida) => {
      const value = agregado[medida] === null ? null : Number(agregado[medida]);
      if (value !== null && !Number.isFinite(value)) throw new Error('Medida não finita na Gold');
      return [medida, value];
    }),
  ) as Totais;
  const base =
    totais.vinculos_total === null || totais.alunos_falecidos === null
      ? null
      : totais.vinculos_total - totais.alunos_falecidos;
  const evadidosCurso =
    totais.alunos_desvinculados === null || totais.alunos_transferidos === null
      ? null
      : totais.alunos_desvinculados + totais.alunos_transferidos;
  const taxa = (numerador: number | null) =>
    base === null || base <= 0 || numerador === null ? null : numerador / base;

  return {
    totais,
    base_risco: base,
    taxas: {
      evasao_curso: taxa(evadidosCurso),
      evasao_ies: taxa(totais.alunos_desvinculados),
    },
    qualidade: {
      sem_dados: agregado.registros_com_alunos === 0,
      registros_com_alunos: agregado.registros_com_alunos,
      registros_sem_alunos: agregado.registros_sem_alunos,
      dados_incompletos: agregado.dados_incompletos ?? false,
      flag_valor_negativo: agregado.flag_valor_negativo ?? false,
      flag_grupo_pequeno: base === null ? null : base < 30,
    },
  };
}
