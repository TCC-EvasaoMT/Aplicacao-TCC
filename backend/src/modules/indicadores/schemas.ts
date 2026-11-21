import { medidas } from './calculos.js';

const codigo = { type: 'string', pattern: '^\\d+$', minLength: 1, maxLength: 32 };
const texto = { type: 'string', minLength: 1, maxLength: 200, pattern: '\\S' };
const numeroNulo = { type: 'number', nullable: true };

export const filtrosQuerySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['ano'],
  properties: {
    ano: { type: 'integer', minimum: 1900, maximum: 9999, description: 'Ano do censo presente na fato de cursos.', examples: [2023] },
    codigo_curso: { ...codigo, description: 'Código original do curso, como texto.', examples: ['00123'] },
    codigo_area_geral: { ...codigo, description: 'Código da área geral CINE; mantém zeros iniciais.', examples: ['01'] },
    codigo_municipio_oferta: { ...codigo, description: 'Município de oferta presencial; não é a sede da IES.' },
    modalidade: { ...texto, description: 'Valor retornado em modalidades por /filtros.' },
    categoria_administrativa: { ...texto, description: 'Valor retornado em categorias_administrativas.' },
    organizacao_academica: { ...texto, description: 'Valor retornado em organizacoes_academicas.' },
    codigo_municipio_sede: { ...codigo, description: 'Município da sede da instituição, inclusive para cursos EaD.' },
  },
};

export const resumoSchema = {
  type: 'object', additionalProperties: false,
  example: {
    filtros: { ano: 2023, codigo_curso: '001' },
    totais: { vinculos_total: 100, ingressantes_total: 20, matriculas_total: 70,
      concluintes_total: 20, alunos_cursando: 50, alunos_desvinculados: 10,
      alunos_transferidos: 5, alunos_matricula_trancada: 15, alunos_falecidos: 0 },
    base_risco: 100,
    taxas: { evasao_curso: 0.15, evasao_ies: 0.1 },
    qualidade: { sem_dados: false, registros_com_alunos: 1, registros_sem_alunos: 0,
      dados_incompletos: false, flag_valor_negativo: false, flag_grupo_pequeno: false },
  },
  required: ['filtros', 'totais', 'base_risco', 'taxas', 'qualidade'],
  properties: {
    filtros: filtrosQuerySchema,
    totais: {
      type: 'object', additionalProperties: false, required: [...medidas],
      properties: Object.fromEntries(medidas.map(m => [m, numeroNulo])),
    },
    base_risco: { ...numeroNulo, description: 'Soma dos vínculos menos soma dos falecidos.' },
    taxas: {
      type: 'object', additionalProperties: false, required: ['evasao_curso', 'evasao_ies'],
      properties: {
        evasao_curso: { ...numeroNulo, description: '(Desvinculados + transferidos) / base de risco. Proporção: 0.2 representa 20%; não limitada a [0,1] por causa do ruído.' },
        evasao_ies: { ...numeroNulo, description: 'Desvinculados / base de risco; não identifica nominalmente uma IES.' },
      },
    },
    qualidade: {
      type: 'object', additionalProperties: false,
      required: ['sem_dados', 'registros_com_alunos', 'registros_sem_alunos', 'dados_incompletos', 'flag_valor_negativo', 'flag_grupo_pequeno'],
      properties: {
        sem_dados: { type: 'boolean' },
        registros_com_alunos: { type: 'integer', minimum: 0 },
        registros_sem_alunos: { type: 'integer', minimum: 0, description: 'Linhas sem medidas de alunos, por exemplo cursos só com docentes.' },
        dados_incompletos: { type: 'boolean', description: 'Alguma medida está ausente em uma linha com vínculos; o total dessa medida será null.' },
        flag_valor_negativo: { type: 'boolean', description: 'Alguma linha do recorte tem a marca de valor negativo na Gold.' },
        flag_grupo_pequeno: { type: 'boolean', nullable: true, description: 'Base agregada menor que 30; null se não calculável.' },
      },
    },
  },
};
