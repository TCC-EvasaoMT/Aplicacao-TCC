# Proteção da API pública

O painel e as consultas continuam públicos. Os controles desta entrega protegem o transporte HTTP da aplicação; login, sessão e permissões administrativas permanecem planejados em [AUTORIZACAO.md](AUTORIZACAO.md).

## Organização

`backend/src/plugins/seguranca.ts` registra `@fastify/helmet` e `@fastify/rate-limit` no contexto raiz, antes dos módulos. `app.ts` define limites HTTP e trata erros com mensagens controladas. `config/index.ts` valida a configuração, e `server.ts` a entrega à composição. Os módulos continuam responsáveis por seus contratos e cálculos.

## Limite de requisições

Por padrão, cada IP pode fazer **120 chamadas em uma janela de 60 segundos**, compartilhadas entre todos os caminhos `/api` e `/api/*`, inclusive parâmetros inválidos e caminhos inexistentes. Chamadas HEAD também contam. O bloqueio ocorre antes de consultar a Gold.

Configure `HTTP_RATE_LIMIT_MAX` em `backend/.env` ou no ambiente do processo. Aceita inteiros de 1 a 10000; um valor inválido impede a inicialização. A janela é fixa em 60 segundos a partir da primeira chamada. A configuração é lida ao iniciar o backend.

Ao ultrapassar o limite, a API responde `429`:

```json
{
	"erro": "LIMITE_REQUISICOES",
	"mensagem": "Limite de requisições atingido. Aguarde o tempo indicado em Retry-After."
}
```

`Retry-After` informa a espera em segundos. `X-RateLimit-Limit`, `X-RateLimit-Remaining` e `X-RateLimit-Reset` informam limite, saldo e segundos até a renovação. As três rotas de consulta documentam `429` no Swagger. O frontend mantém seu tratamento de falha e nova tentativa manual, sem repetição automática de chamadas bloqueadas.

O contador fica na memória de cada processo, com cache limitado a 5000 chaves pelo plugin. Reiniciar o processo ou remover entradas antigas do cache reinicia os contadores correspondentes. Instâncias distintas têm cotas independentes. IPv4 é agrupado por endereço e IPv6 por rede /64; pessoas compartilhando uma saída de rede também compartilham a cota. Para múltiplas instâncias ou exposição externa, avaliar armazenamento compartilhado e limitação no ingresso.

`/health`, Swagger e arquivos do frontend não consomem essa cota. O health consulta o banco; a implantação também deve limitar tráfego e proteger recursos no ingresso. Este mecanismo não é proteção completa contra negação de serviço.

## Proxy e limites HTTP

`trustProxy` permanece desativado. Cabeçalhos como `X-Forwarded-For` não mudam a identidade usada na limitação. Atrás do Vite ou de outro proxy, a API observa o IP desse proxy; os visitantes podem compartilhar a mesma cota. Antes da implantação, definir os proxies confiáveis e bloquear acesso direto indevido ao backend. Não habilitar confiança irrestrita para resolver esse agrupamento.

O Fastify aceita corpos de até **16 KiB** nas rotas que processam corpo e configura **10 segundos para recebimento da requisição**. O timeout de recebimento não cancela handlers nem consultas em execução. O Node verifica timeouts periodicamente; não é um cronômetro preciso por chamada. As rotas de negócio atuais são consultas GET e não recebem corpo.

Excesso de corpo retorna `413`, tipo de conteúdo não suportado retorna `415`, e erros HTTP reconhecidos preservam `400`, `401`, `403`, `404`, `408` e `429` com mensagens controladas. O `408` gerado diretamente pelo servidor HTTP pode ter formato próprio, antes do handler. Suportar `401`/`403` no tratamento de erros não implementa autenticação. Falhas da Gold continuam como `503`; erros inesperados retornam `500` sem detalhes internos.

O pool mantém cinco conexões, espera de conexão de dois segundos e timeout SQL de 2,5 segundos. Nenhum desses limites comprova a meta de resposta com dados reais.

## Cabeçalhos e política de conteúdo

Helmet aplica cabeçalhos às respostas, inclusive erros: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` e Content Security Policy (CSP), entre outros padrões do plugin.

Na aplicação compilada, scripts, fontes e conexões usam a própria origem. Imagens também podem usar `data:` para os controles do Bootstrap. Embutir a página em frames e carregar objetos são bloqueados. Estilos inline são permitidos porque Recharts os usa no gráfico e no tooltip; scripts inline e `eval` não são liberados.

Somente as rotas do Swagger recebem a CSP estática fornecida por seu plugin, compatível com os arquivos e hashes da versão instalada. A validação externa de especificações fica desativada. Swagger continua registrado apenas em `NODE_ENV=development`, inclusive quando a interface compilada é servida pelo Fastify.

HSTS e a diretiva de atualização automática para HTTPS ficam desativados neste servidor local HTTP. TLS, redirecionamento para HTTPS e HSTS precisam ser definidos no ingresso da implantação. Não foi adicionado CORS: o frontend usa a mesma origem, pelo proxy Vite no desenvolvimento e pelo Fastify na versão compilada. A página servida diretamente pelo Vite não recebe os cabeçalhos HTML do Fastify.

## Verificação

`pnpm check` inclui testes de acesso público, cabeçalhos, limite compartilhado, rejeição de IP forjado em cabeçalhos, renovação da janela, independência entre instâncias, corpo excessivo, tipos de conteúdo, erros controlados, configuração inválida e Swagger desativado em produção. Os testes da SPA verificam a coexistência dos arquivos e da API.

Para testar manualmente, inicie o backend com `HTTP_RATE_LIMIT_MAX=3` em um ambiente local de teste e faça quatro chamadas a `/api/v1/filtros` dentro de um minuto. A quarta deve retornar `429` com `Retry-After`; depois da janela, a consulta volta a funcionar. Restaure o limite normal ao encerrar o teste. A carga sintética é suficiente para essa verificação; desempenho real e configuração de infraestrutura são validações separadas.

Referências: [Helmet para Fastify](https://github.com/fastify/fastify-helmet), [limitação de requisições](https://github.com/fastify/fastify-rate-limit) e [Swagger UI](https://github.com/fastify/fastify-swagger-ui).
