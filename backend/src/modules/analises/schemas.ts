import {
	anoSchema,
	filtrosRecorteProperties,
	resultadoResumoProperties
} from '../indicadores/index.js'
import { MAX_ANOS } from './evolucao.js'
import { agrupamentos, MAX_GRUPOS } from './comparacoes.js'
import { BASE_MINIMA, taxasDispersao } from './dispersao.js'
import { dimensoesRanking, situacoes, taxasRanking } from './ranking.js'
import { codigosFatores, fatoresPerfil } from './perfil.js'

export const comparacaoQuerySchema = {
	type: 'object',
	additionalProperties: false,
	required: ['ano', 'agrupar_por'],
	properties: {
		ano: anoSchema,
		agrupar_por: {
			type: 'string',
			enum: Object.keys(agrupamentos),
			examples: ['categoria_administrativa']
		},
		limite: {
			type: 'integer',
			minimum: 1,
			maximum: MAX_GRUPOS,
			default: MAX_GRUPOS,
			description:
				'Máximo de grupos retornados. Ordenação por código/texto, nunca pela taxa.'
		},
		grupos: {
			type: 'array',
			minItems: 1,
			maxItems: MAX_GRUPOS,
			uniqueItems: true,
			items: { type: 'string', minLength: 1, maxLength: 200, pattern: '\\S' },
			description:
				'Seleção opcional de códigos ou textos da dimensão. Repita o parâmetro: grupos=001&grupos=002. Um único valor também é aceito. Sem seleção, inclui grupos sem identificador.'
		},
		...filtrosRecorteProperties
	},
	allOf: Object.entries(agrupamentos).map(([chave, { filtro }]) => ({
		if: { type: 'object', properties: { agrupar_por: { const: chave } } },
		then: {
			type: 'object',
			properties: {
				grupos: { type: 'array', items: filtrosRecorteProperties[filtro] }
			}
		}
	}))
}

export const comparacaoSchema = {
	type: 'object',
	additionalProperties: false,
	required: ['filtros', 'total_grupos', 'truncado', 'grupos'],
	properties: {
		filtros: {
			type: 'object',
			additionalProperties: false,
			required: ['ano', 'agrupar_por', 'limite'],
			properties: comparacaoQuerySchema.properties
		},
		total_grupos: {
			type: 'integer',
			minimum: 0,
			description:
				'Quantidade de grupos encontrados após filtros e seleção, antes do limite.'
		},
		truncado: {
			type: 'boolean',
			description:
				'Há outros grupos no recorte que não foram retornados por causa do limite.'
		},
		grupos: {
			type: 'array',
			maxItems: MAX_GRUPOS,
			items: {
				type: 'object',
				additionalProperties: false,
				required: ['grupo', 'totais', 'base_risco', 'taxas', 'qualidade'],
				properties: {
					grupo: {
						type: 'object',
						additionalProperties: false,
						required: ['valor', 'nome'],
						properties: {
							valor: {
								type: 'string',
								nullable: true,
								description:
									'Código original ou atributo textual; null quando ausente. Nunca é um ID sequencial.'
							},
							nome: {
								type: 'string',
								nullable: true,
								description: 'Rótulo disponível na dimensão, ou null.'
							}
						}
					},
					...resultadoResumoProperties
				}
			}
		}
	}
}

export const evolucaoQuerySchema = {
	type: 'object',
	additionalProperties: false,
	required: ['ano_inicial', 'ano_final'],
	properties: {
		ano_inicial: {
			...anoSchema,
			description: 'Primeiro ano do intervalo inclusivo.',
			examples: [2022]
		},
		ano_final: {
			...anoSchema,
			description: `Último ano; deve ser maior ou igual ao inicial. Máximo de ${MAX_ANOS} anos inclusivos.`,
			examples: [2024]
		},
		...filtrosRecorteProperties
	}
}

export const evolucaoSchema = {
	type: 'object',
	additionalProperties: false,
	required: ['filtros', 'serie'],
	properties: {
		filtros: evolucaoQuerySchema,
		serie: {
			type: 'array',
			minItems: 1,
			maxItems: MAX_ANOS,
			description:
				'Uma entrada por ano solicitado, em ordem crescente. Anos sem registros têm medidas null e qualidade.sem_dados=true.',
			items: {
				type: 'object',
				additionalProperties: false,
				required: ['ano', 'totais', 'base_risco', 'taxas', 'qualidade'],
				properties: { ano: anoSchema, ...resultadoResumoProperties }
			}
		}
	}
}

export const dispersaoQuerySchema = {
	type: 'object',
	additionalProperties: false,
	required: ['ano'],
	properties: { ano: anoSchema, ...filtrosRecorteProperties }
}

const porTaxa = (schema: object, descricao: string) => ({
	type: 'object',
	additionalProperties: false,
	required: [...taxasDispersao],
	description: descricao,
	properties: Object.fromEntries(taxasDispersao.map((t) => [t, schema]))
})
const contagem = { type: 'integer', minimum: 0 }

export const dispersaoSchema = {
	type: 'object',
	additionalProperties: false,
	required: ['filtros', 'referencias', 'cursos'],
	properties: {
		filtros: dispersaoQuerySchema,
		referencias: {
			type: 'object',
			additionalProperties: false,
			required: [
				'base_minima',
				'alta_evasao',
				'cursos_na_referencia',
				'cursos_fora_da_referencia'
			],
			properties: {
				base_minima: {
					type: 'integer',
					const: BASE_MINIMA,
					description:
						'Base de risco mínima para a zona crítica; mesmo limite de flag_grupo_pequeno.'
				},
				alta_evasao: porTaxa(
					{ type: 'number', nullable: true },
					'Linha de alta evasão de cada taxa: soma dos numeradores dividida pela soma das bases dos cursos com a taxa calculável. null quando nenhum curso tem a taxa.'
				),
				cursos_na_referencia: porTaxa(
					contagem,
					'Cursos usados no cálculo de cada linha.'
				),
				cursos_fora_da_referencia: porTaxa(
					contagem,
					'Cursos sem a taxa calculável (base não positiva, medida ausente ou só docentes).'
				)
			}
		},
		cursos: {
			type: 'array',
			description:
				'Um item por código de curso, em ordem textual do código. Não é ranking.',
			items: {
				type: 'object',
				additionalProperties: false,
				required: [
					'curso',
					'totais',
					'base_risco',
					'taxas',
					'qualidade',
					'zona_critica'
				],
				properties: {
					curso: {
						type: 'object',
						additionalProperties: false,
						required: ['codigo', 'nome'],
						properties: {
							codigo: {
								type: 'string',
								nullable: true,
								description: 'Código original do curso; null quando ausente.'
							},
							nome: { type: 'string', nullable: true }
						}
					},
					...resultadoResumoProperties,
					zona_critica: porTaxa(
						{ type: 'boolean' },
						`Taxa do curso maior que a linha de alta evasão e base de risco de pelo menos ${BASE_MINIMA}.`
					)
				}
			}
		}
	}
}

export const rankingQuerySchema = {
	type: 'object',
	additionalProperties: false,
	required: ['ano', 'dimensao'],
	properties: {
		ano: anoSchema,
		dimensao: {
			type: 'string',
			enum: [...dimensoesRanking],
			description: 'Área geral CINE ou modalidade.'
		},
		taxa: {
			type: 'string',
			enum: [...taxasRanking],
			default: 'evasao_curso',
			description: 'Taxa usada na ordenação, da maior para a menor.'
		},
		...filtrosRecorteProperties
	}
}

export const rankingSchema = {
	type: 'object',
	additionalProperties: false,
	required: ['filtros', 'base_minima', 'classificados', 'grupos'],
	properties: {
		filtros: {
			type: 'object',
			additionalProperties: false,
			required: ['ano', 'dimensao', 'taxa'],
			properties: rankingQuerySchema.properties
		},
		base_minima: {
			type: 'integer',
			const: BASE_MINIMA,
			description:
				'Base de risco mínima para receber posição; mesmo limite de flag_grupo_pequeno.'
		},
		classificados: {
			type: 'integer',
			minimum: 0,
			description: 'Quantidade de grupos com posição.'
		},
		grupos: {
			type: 'array',
			description:
				'Todas as categorias do recorte: primeiro as classificadas, da maior para a menor taxa; depois base pequena, sem taxa e sem identificador, cada uma em ordem de código.',
			items: {
				type: 'object',
				additionalProperties: false,
				required: [
					'grupo',
					'totais',
					'base_risco',
					'taxas',
					'qualidade',
					'situacao',
					'posicao',
					'empate'
				],
				properties: {
					grupo: {
						type: 'object',
						additionalProperties: false,
						required: ['valor', 'nome'],
						properties: {
							valor: { type: 'string', nullable: true },
							nome: { type: 'string', nullable: true }
						}
					},
					...resultadoResumoProperties,
					situacao: {
						type: 'string',
						enum: [...situacoes],
						description:
							'classificado; base_pequena (base de risco abaixo do mínimo); sem_taxa (base não positiva, medida ausente ou só docentes); sem_identificador.'
					},
					posicao: {
						type: 'integer',
						minimum: 1,
						nullable: true,
						description:
							'Classificação por competição (1, 2, 2, 4); null fora da classificação.'
					},
					empate: {
						type: 'boolean',
						description: 'Divide a posição com outro grupo de mesma taxa.'
					}
				}
			}
		}
	}
}

export const perfilQuerySchema = {
	type: 'object',
	additionalProperties: false,
	required: ['ano', 'fator'],
	properties: {
		ano: anoSchema,
		fator: {
			type: 'string',
			enum: codigosFatores,
			description: `Um dos 12 fatores de prioridade 1: ${codigosFatores.map((c) => `${c} (${fatoresPerfil[c].nome})`).join('; ')}.`
		},
		...filtrosRecorteProperties
	}
}

// Resumo de uma categoria de perfil: o do resumo, sem ingressantes, que a fato
// de perfil não tem.
const { totais: totaisResumo, qualidade: qualidadeResumo } =
	resultadoResumoProperties
const { ingressantes_total: _ingressantes, ...totaisPerfil } =
	totaisResumo.properties
const {
	registros_sem_ingressantes: _registros,
	ingressantes_minimo: _minimo,
	...qualidadePerfil
} = qualidadeResumo.properties
const resumoPerfilProperties = {
	...resultadoResumoProperties,
	totais: {
		...totaisResumo,
		required: Object.keys(totaisPerfil),
		properties: totaisPerfil
	},
	qualidade: {
		...qualidadeResumo,
		required: Object.keys(qualidadePerfil),
		properties: qualidadePerfil
	}
}
const resumoPerfil = {
	type: 'object',
	additionalProperties: false,
	required: ['totais', 'base_risco', 'taxas', 'qualidade'],
	properties: resumoPerfilProperties
}

export const perfilSchema = {
	type: 'object',
	additionalProperties: false,
	required: ['filtros', 'fator', 'base_minima', 'conjunto', 'categorias'],
	properties: {
		filtros: {
			type: 'object',
			additionalProperties: false,
			required: ['ano', 'fator'],
			properties: perfilQuerySchema.properties
		},
		fator: {
			type: 'object',
			additionalProperties: false,
			required: ['codigo', 'nome', 'grupo'],
			properties: {
				codigo: { type: 'string', enum: codigosFatores },
				nome: { type: 'string' },
				grupo: { type: 'string' }
			}
		},
		base_minima: {
			type: 'integer',
			const: BASE_MINIMA,
			description:
				'Base de risco abaixo da qual a categoria é grupo pequeno; mesmo limite de flag_grupo_pequeno.'
		},
		conjunto: {
			...resumoPerfil,
			nullable: true,
			description:
				'Todas as categorias do fator somadas antes de dividir; null se o fator não está no catálogo. Pode diferir do resumo: cada fator é uma consulta própria ao SEDAP+, com ruído e grupos omitidos.'
		},
		categorias: {
			type: 'array',
			description:
				'Todas as categorias do fator em gold.dim_perfil, na ordem do catálogo, inclusive as sem registros no recorte (sem_dados) e os códigos fora do catálogo.',
			items: {
				type: 'object',
				additionalProperties: false,
				required: ['categoria', ...resumoPerfil.required],
				properties: {
					categoria: {
						type: 'object',
						additionalProperties: false,
						required: ['codigo', 'nome', 'ordem'],
						properties: {
							codigo: {
								type: 'string',
								nullable: true,
								description: 'Código bruto no SEDAP+; null é o valor vazio.'
							},
							nome: { type: 'string' },
							ordem: { type: 'integer', nullable: true }
						}
					},
					...resumoPerfilProperties
				}
			}
		}
	}
}

const numeroOuNulo = { type: 'number', nullable: true }
const proporcao = (description: string) => ({ ...numeroOuNulo, description })

export const coorteQuerySchema = {
	type: 'object',
	additionalProperties: false,
	required: ['ano_ingresso'],
	properties: {
		ano_ingresso: {
			...anoSchema,
			description:
				'Ano de ingresso da turma. Só turmas cujo ano de ingresso foi carregado como ano do censo têm tamanho inicial.'
		},
		...filtrosRecorteProperties
	}
}

export const coorteSchema = {
	type: 'object',
	additionalProperties: false,
	required: [
		'filtros',
		'tamanho_inicial',
		'base_minima',
		'cursos_iniciais',
		'serie'
	],
	properties: {
		filtros: {
			type: 'object',
			additionalProperties: false,
			required: ['ano_ingresso'],
			properties: coorteQuerySchema.properties
		},
		tamanho_inicial: {
			...numeroOuNulo,
			description:
				'Vínculos da turma no censo do ano de ingresso; null sem essa linha. Não usa ingressantes_total, que tem ruído alto.'
		},
		base_minima: {
			type: 'integer',
			const: BASE_MINIMA,
			description:
				'Turma com tamanho inicial abaixo deste valor é grupo pequeno.'
		},
		cursos_iniciais: {
			type: 'integer',
			minimum: 0,
			description: 'Cursos com linha no ano de ingresso: os que formam a turma.'
		},
		serie: {
			type: 'array',
			description:
				'Um item por ano do censo carregado, do ingresso em diante; vazia sem tamanho inicial.',
			items: {
				type: 'object',
				additionalProperties: false,
				required: [
					'ano',
					'anos_desde_ingresso',
					'totais',
					'acumulados',
					'continua',
					'taxas',
					'qualidade'
				],
				properties: {
					ano: { type: 'integer' },
					anos_desde_ingresso: { type: 'integer', minimum: 0 },
					totais: {
						type: 'object',
						additionalProperties: false,
						required: [
							'vinculos_total',
							'concluintes_total',
							'alunos_cursando',
							'alunos_desvinculados',
							'alunos_transferidos',
							'alunos_matricula_trancada',
							'alunos_falecidos'
						],
						properties: {
							vinculos_total: numeroOuNulo,
							concluintes_total: numeroOuNulo,
							alunos_cursando: numeroOuNulo,
							alunos_desvinculados: numeroOuNulo,
							alunos_transferidos: numeroOuNulo,
							alunos_matricula_trancada: numeroOuNulo,
							alunos_falecidos: numeroOuNulo
						}
					},
					acumulados: {
						type: 'object',
						additionalProperties: false,
						required: ['evadidos', 'desvinculados', 'concluintes'],
						properties: {
							evadidos: proporcao(
								'Desvinculados + transferidos somados do ingresso até este ano; null a partir de um ano sem a medida.'
							),
							desvinculados: numeroOuNulo,
							concluintes: numeroOuNulo
						}
					},
					continua: proporcao('Cursando + trancados neste ano.'),
					taxas: {
						type: 'object',
						additionalProperties: false,
						required: [
							'evadiu',
							'evadiu_ies',
							'concluiu',
							'continua',
							'residuo'
						],
						properties: {
							evadiu: proporcao('Já evadiu do curso ÷ tamanho inicial.'),
							evadiu_ies: proporcao(
								'Desvinculados acumulados ÷ tamanho inicial.'
							),
							concluiu: proporcao('Concluintes acumulados ÷ tamanho inicial.'),
							continua: proporcao('Cursando + trancados ÷ tamanho inicial.'),
							residuo: proporcao(
								'1 − (evadiu + concluiu + continua): falecidos, ruído, cursos omitidos no ano e vínculos que mudam de curso.'
							)
						}
					},
					qualidade: {
						type: 'object',
						additionalProperties: false,
						required: [
							'sem_dados',
							'registros',
							'cursos_iniciais_ausentes',
							'registros_fora_da_turma',
							'vinculos_fora_da_turma',
							'dados_incompletos',
							'flag_valor_negativo',
							'flag_grupo_pequeno'
						],
						properties: {
							sem_dados: { type: 'boolean' },
							registros: { type: 'integer', minimum: 0 },
							cursos_iniciais_ausentes: {
								type: 'integer',
								minimum: 0,
								description:
									'Cursos da turma sem linha neste ano, por exemplo omitidos pelo SEDAP+.'
							},
							registros_fora_da_turma: {
								type: 'integer',
								minimum: 0,
								description:
									'Linhas com o mesmo ano de ingresso em cursos sem linha inicial; não entram nas somas.'
							},
							vinculos_fora_da_turma: numeroOuNulo,
							dados_incompletos: { type: 'boolean' },
							flag_valor_negativo: { type: 'boolean' },
							flag_grupo_pequeno: { type: 'boolean' }
						}
					}
				}
			}
		}
	}
}
