import type { FastifyInstance, FastifyRequest } from 'fastify';
import { calcularResumo } from './calculos.js';
import type { Consultas, Filtros } from './consultas.js';
import { catalogoSchema, erroSchema, filtrosQuerySchema, resumoSchema } from './schemas.js';

async function consultarGold<T>(request: FastifyRequest, tarefa: () => Promise<T>): Promise<T> {
  try {
    return await tarefa();
  } catch (error) {
    const code = error instanceof Error && 'code' in error ? String(error.code) : 'DB_ERROR';
    request.log.error({ code }, 'Falha na consulta à Gold');
    throw Object.assign(new Error('Camada Gold indisponível. Tente novamente após a carga ou verifique a conexão.'), {
      statusCode: 503, code: 'GOLD_INDISPONIVEL',
    });
  }
}

export function registrarRotas(app: FastifyInstance, consultas: Consultas) {
  const erros = { 400: erroSchema, 500: erroSchema, 503: erroSchema };
  app.get('/health', {
    schema: {
      tags: ['Operação'], summary: 'Verifica o acesso à Gold e às dimensões utilizadas.',
      response: {
        200: { type: 'object', required: ['status'], properties: { status: { type: 'string', const: 'ok' } } },
        503: erroSchema,
      },
    },
  }, async (request) => {
    await consultarGold(request, () => consultas.health());
    return { status: 'ok' };
  });

  app.get('/api/v1/filtros', {
    schema: {
      tags: ['Indicadores'], summary: 'Lista os filtros existentes na fato de cursos.',
      description: 'Catálogo independente dos filtros ativos, sem IDs sequenciais. Anos de ingresso presentes apenas nas coortes não entram. Municípios sem código não são opções; seus registros continuam nos totais sem filtro municipal.',
      querystring: { type: 'object', additionalProperties: false, properties: {} },
      response: { 200: catalogoSchema, ...erros },
    },
  }, async request => consultarGold(request, () => consultas.filtros()));

  app.get<{ Querystring: Filtros }>('/api/v1/indicadores/resumo', {
    schema: {
      tags: ['Indicadores'], summary: 'Calcula o resumo de um ano com filtros combinados por E.',
      description: 'Exemplo: /api/v1/indicadores/resumo?ano=2023&codigo_area_geral=01. Calcula as taxas sobre as somas; base não positiva ou ausente retorna null. Valores negativos e decimais são preservados. Um recorte sem alunos retorna 200, totais null e qualidade.sem_dados=true.',
      querystring: filtrosQuerySchema,
      response: { 200: resumoSchema, ...erros },
    },
  }, async (request) => {
    const agregado = await consultarGold(request, () => consultas.resumo(request.query));
    return { filtros: request.query, ...calcularResumo(agregado) };
  });
}
