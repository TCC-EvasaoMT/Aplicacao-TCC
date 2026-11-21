import type { FastifyRequest } from 'fastify';

export const origem = `
  FROM gold.fato_evasao_curso f
  JOIN gold.dim_tempo t USING (id_tempo)
  JOIN gold.dim_curso c USING (id_curso)
  JOIN gold.dim_area_conhecimento a USING (id_area_conhecimento)
  JOIN gold.dim_localidade l USING (id_localidade)
  JOIN gold.dim_oferta o USING (id_oferta)
  JOIN gold.dim_instituicao i USING (id_instituicao)`;

export async function consultarGold<T>(request: FastifyRequest, tarefa: () => Promise<T>): Promise<T> {
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
