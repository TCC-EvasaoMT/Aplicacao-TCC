export const erroSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['erro', 'mensagem'],
  properties: { erro: { type: 'string' }, mensagem: { type: 'string' } },
  example: {
    erro: 'GOLD_INDISPONIVEL',
    mensagem: 'Camada Gold indisponível. Tente novamente após a carga ou verifique a conexão.',
  },
};
