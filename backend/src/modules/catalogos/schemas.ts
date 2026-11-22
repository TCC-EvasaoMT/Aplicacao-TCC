const opcoesCodigo = {
  type: 'array',
  items: {
    type: 'object',
    additionalProperties: false,
    required: ['codigo', 'nome'],
    properties: { codigo: { type: 'string' }, nome: { type: 'string', nullable: true } },
  },
};
const opcoesTexto = { type: 'array', items: { type: 'string' } };
export const catalogoSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'anos',
    'cursos',
    'areas_gerais',
    'municipios_oferta',
    'municipios_sede',
    'modalidades',
    'categorias_administrativas',
    'organizacoes_academicas',
  ],
  properties: {
    anos: { type: 'array', items: { type: 'integer' } },
    cursos: opcoesCodigo,
    areas_gerais: opcoesCodigo,
    municipios_oferta: opcoesCodigo,
    municipios_sede: opcoesCodigo,
    modalidades: opcoesTexto,
    categorias_administrativas: opcoesTexto,
    organizacoes_academicas: opcoesTexto,
  },
};
