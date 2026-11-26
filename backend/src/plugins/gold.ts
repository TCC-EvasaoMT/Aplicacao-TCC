import type { FastifyRequest } from 'fastify'
import { codigoErroSeguro } from './logs.js'

// As fatos de alunos compartilham as dimensões do curso; os aliases são os
// das colunas de filtro.
const dimensoesDoCurso = `
  JOIN gold.dim_tempo t USING (id_tempo)
  JOIN gold.dim_curso c USING (id_curso)
  JOIN gold.dim_area_conhecimento a USING (id_area_conhecimento)
  JOIN gold.dim_localidade l USING (id_localidade)
  JOIN gold.dim_oferta o USING (id_oferta)
  JOIN gold.dim_instituicao i USING (id_instituicao)`

export const origemPerfil = `
  FROM gold.fato_evasao_perfil f${dimensoesDoCurso}`

export const origem = `
  FROM gold.fato_evasao_curso f${dimensoesDoCurso}
  LEFT JOIN gold.fato_evasao_coorte ci
    ON ci.id_tempo = f.id_tempo AND ci.id_curso = f.id_curso
    AND ci.id_tempo_ingresso = f.id_tempo`

export async function consultarGold<T>(
	request: FastifyRequest,
	tarefa: () => Promise<T>
): Promise<T> {
	try {
		return await tarefa()
	} catch (error) {
		const code = codigoErroSeguro(error)
		request.log.error({ code }, 'Falha na consulta à Gold')
		throw Object.assign(
			new Error(
				'Camada Gold indisponível. Tente novamente após a carga ou verifique a conexão.'
			),
			{
				statusCode: 503,
				code: 'GOLD_INDISPONIVEL'
			}
		)
	}
}
