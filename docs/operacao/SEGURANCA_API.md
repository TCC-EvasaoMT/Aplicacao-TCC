# Proteção da API pública

O painel e as consultas são públicos. A aplicação limita requisições, aplica cabeçalhos HTTP e controla os campos dos logs. Login, sessão e permissões administrativas aguardam integração, conforme o [modelo de acesso](../arquitetura/AUTORIZACAO.md). O servidor local usa HTTP; HTTPS depende da implantação.

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

`Retry-After` informa a espera em segundos. `X-RateLimit-Limit`, `X-RateLimit-Remaining` e `X-RateLimit-Reset` informam limite, saldo e segundos até a renovação. As quatro rotas de consulta documentam `429` no Swagger. O frontend orienta aguardar e permite nova tentativa manual, sem repetição automática de chamadas bloqueadas.

O contador fica na memória de cada processo, com cache limitado a 5000 chaves pelo plugin. Reiniciar o processo ou remover entradas antigas do cache reinicia os contadores correspondentes. Instâncias distintas têm cotas independentes. IPv4 é agrupado por endereço e IPv6 por rede /64; pessoas compartilhando uma saída de rede também compartilham a cota. Para múltiplas instâncias ou exposição externa, avaliar armazenamento compartilhado e limitação no ingresso.

`/health`, Swagger e arquivos do frontend não consomem essa cota. O health consulta o banco; a implantação também deve limitar tráfego e proteger recursos no ingresso. Este mecanismo não é proteção completa contra negação de serviço.

## Proxy e limites HTTP

`trustProxy` permanece desativado. Cabeçalhos como `X-Forwarded-For` não mudam a identidade usada na limitação. Atrás do Vite ou de outro proxy, a API observa o IP desse proxy; os visitantes podem compartilhar a mesma cota. Antes da implantação, definir os proxies confiáveis e bloquear acesso direto indevido ao backend. Não habilitar confiança irrestrita para resolver esse agrupamento.

O Fastify aceita corpos de até **16 KiB** nas rotas que processam corpo e configura **10 segundos para recebimento da requisição**. O timeout de recebimento não cancela handlers nem consultas em execução. O Node verifica timeouts periodicamente; não é um cronômetro preciso por chamada. As rotas de negócio atuais são consultas GET e não recebem corpo.

Excesso de corpo retorna `413`, tipo de conteúdo não suportado retorna `415`, e erros HTTP reconhecidos preservam `400`, `401`, `403`, `404`, `408` e `429` com mensagens controladas. O `408` gerado diretamente pelo servidor HTTP pode ter formato próprio, antes do handler. Suportar `401`/`403` no tratamento de erros não implementa autenticação. Falhas da Gold continuam como `503`; erros inesperados retornam `500` sem detalhes internos.

O pool mantém cinco conexões, espera de conexão de dois segundos e timeout SQL de 2,5 segundos. Nenhum desses limites comprova a meta de resposta com dados reais.

## Cabeçalhos e política de conteúdo

Helmet aplica cabeçalhos às respostas, inclusive erros: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` e Content Security Policy (CSP), entre outros padrões do plugin.

Na aplicação compilada, scripts, fontes e conexões usam a própria origem. Imagens também podem usar `data:`, permissão criada para os controles do Bootstrap; a interface atual, com PrimeReact e Tailwind, não depende dela, e a diretiva pode ser revista. Embutir a página em frames e carregar objetos são bloqueados. Estilos inline são permitidos porque Recharts os usa no gráfico e no tooltip e o PrimeReact injeta uma folha de estilo pequena para esconder campos auxiliares; scripts inline e `eval` não são liberados.

Somente as rotas do Swagger recebem a CSP estática fornecida por seu plugin, compatível com os arquivos e hashes da versão instalada. A validação externa de especificações fica desativada. Swagger continua registrado apenas em `NODE_ENV=development`, inclusive quando a interface compilada é servida pelo Fastify.

HSTS e a diretiva de atualização automática para HTTPS ficam desativados neste servidor local HTTP. TLS, redirecionamento para HTTPS e HSTS precisam ser definidos no ingresso da implantação. Não foi adicionado CORS: o frontend usa a mesma origem, pelo proxy Vite no desenvolvimento e pelo Fastify na versão compilada. A página servida diretamente pelo Vite não recebe os cabeçalhos HTML do Fastify.

## Logs e correlação

Os logs são enviados em JSON para a saída padrão do processo e aparecem no terminal. A aplicação não cria arquivos em uma pasta `logs/` nem envia eventos ao CloudWatch. Retenção, rotação e coleta precisam ser configuradas no ambiente de execução.

`plugins/logs.ts` configura o logger JSON e registra o término das requisições com método, modelo da rota, status e duração. O backend gera um UUID e o devolve em `X-Request-Id`; o mesmo valor aparece em `reqId` nos logs. Um `X-Request-Id` enviado pelo cliente é ignorado. Caminhos desconhecidos recebem um marcador fixo e rotas de arquivos usam o modelo da rota, sem registrar o caminho fornecido pelo visitante.

Os logs automáticos de requisição do Fastify são substituídos pelo evento controlado. URLs completas, query strings, IP, host, headers e corpos não entram nesse evento. Serializadores de `req`, `res` e `err` restringem o conteúdo, e os campos estruturados de credenciais previstos na configuração são removidos. Falhas registram somente códigos reconhecidos de PostgreSQL, conexão ou Fastify; códigos arbitrários viram `INTERNAL_ERROR`. Mensagens originais, SQL e stack traces não são registrados.

Essa configuração não remove segredos de textos arbitrários escritos por código futuro. Novos logs devem usar mensagens constantes e campos explicitamente revisados, sem interpolar tokens, senhas ou objetos do banco. A perda de stack traces é uma escolha para evitar vazamento; use `reqId`, rota e código para correlacionar falhas. Auditoria administrativa, retenção e envio para um serviço de monitoramento ficam para entregas posteriores.

## Verificação dos controles

`pnpm check` inclui testes de acesso público, cabeçalhos, limite compartilhado, rejeição de IP forjado em cabeçalhos, renovação da janela, independência entre instâncias, corpo excessivo, tipos de conteúdo, erros controlados, configuração inválida e Swagger desativado em produção. Os testes da SPA verificam a coexistência dos arquivos e da API.

O aceite inicial da proteção HTTP no Windows registrou 37 testes, tipos, build e onze cenários de integração PostgreSQL sintética. O navegador confirmou filtros, resumo, gráfico e Swagger sem erros de CSP. O teste de logs cobre credenciais em headers, query, corpo, erro e caminho desconhecido, além da correlação de respostas `503` e `429`. O [registro de validação](VALIDACAO.md) reúne a evidência mais recente e os limites dos testes. Dados reais, proxy de produção e carga distribuída ainda precisam ser validados.

Para testar manualmente, inicie o backend com `HTTP_RATE_LIMIT_MAX=3` em um ambiente local de teste e faça quatro chamadas a `/api/v1/filtros` dentro de um minuto. A quarta deve retornar `429` com `Retry-After`; depois da janela, a consulta volta a funcionar. Restaure o limite normal ao encerrar o teste. A carga sintética é suficiente para essa verificação; desempenho real e configuração de infraestrutura são validações separadas.

Referências: [Helmet para Fastify](https://github.com/fastify/fastify-helmet), [limitação de requisições](https://github.com/fastify/fastify-rate-limit) e [Swagger UI](https://github.com/fastify/fastify-swagger-ui).
