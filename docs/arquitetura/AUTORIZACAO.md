# Acesso ao painel e à administração

O painel é público; a administração exigirá login e permissões. A decisão de acesso foi confirmada em 22/11/2026. A `main` contém as consultas públicas e a proteção HTTP, mas não contém rotas de autenticação nem de administração do ETL. A aplicação escuta somente em `127.0.0.1`.

A autenticação própria foi implementada em `feat/autenticacao-administracao`; a preparação automatizada da demonstração está em `feat/demo-autenticacao`. Ambas aguardam integração por decisão do responsável. Seus comandos, variáveis e tabelas não estão disponíveis na `main`. Ao retomá-las, atualizar código e documentação a partir da versão atual da aplicação.

## Quem pode fazer o quê

A [proteção pública](../operacao/SEGURANCA_API.md) aplica cabeçalhos HTTP, limite de requisições e logs com campos controlados. Identidade e permissões administrativas dependem da integração da autenticação.

| Recurso                                            | Visitante sem login | Administrador autenticado       |
| -------------------------------------------------- | ------------------- | ------------------------------- |
| Consultar catálogo, resumo, evolução e comparações | Permitido           | Permitido                       |
| Acessar o painel e seus arquivos públicos          | Permitido           | Permitido                       |
| Consultar o estado mínimo em `/health`             | Permitido           | Permitido                       |
| Consultar histórico e detalhes do ETL              | Negado              | Permitido com `etl:consultar`   |
| Solicitar reprocessamento do ETL                   | Negado              | Permitido com `etl:reprocessar` |

As duas últimas linhas são funcionalidades planejadas. O Swagger continua disponível apenas em desenvolvimento. O fato de o painel ser público não concede acesso direto ao PostgreSQL, aos arquivos da pipeline ou às credenciais de carga.

## Autenticação e autorização

Autenticação identifica a pessoa; autorização decide quais ações ela pode executar. A decisão adotada é usar autenticação própria, com JWT no cabeçalho `Authorization: Bearer <token>`, sem provedor externo. As contas e sessões usam o schema `app` no mesmo PostgreSQL das camadas, com credencial e migrações próprias. As senhas são hashes Argon2id com salt individual, sem armazenamento reversível.

O perfil `administrador` receberá explicitamente as permissões `etl:consultar` e `etl:reprocessar`. Entrar com uma conta válida não concederá esse perfil automaticamente. A criação do primeiro administrador e a concessão ou revogação de acesso precisarão de um procedimento controlado; não haverá autocadastro público de administradores.

A implementação adiada valida o JWT e consulta no servidor a sessão, o estado da conta e suas permissões. Valores como `admin=true`, parâmetros da URL ou estado do React não concedem acesso.

## Aplicação das regras no Fastify

Na branch de autenticação, o controle é transversal e registrado antes dos módulos protegidos. As rotas da API precisam declarar seu acesso; a ausência de regra válida impede o registro. Antes do handler, o controle verifica a sessão e a permissão exigida. Ao integrar a branch, classificar também a rota de comparações como pública.

Essas verificações devem ocorrer em **toda requisição protegida**, inclusive quando a URL for chamada diretamente fora do frontend. Sessão ausente, inválida ou expirada retornará `401`; identidade válida sem a permissão necessária retornará `403`. O tratamento global de erros precisará preservar esses códigos, em vez de convertê-los em `500`.

O frontend poderá ocultar controles administrativos para melhorar a navegação, mas a decisão de acesso será sempre do servidor. Isso segue a orientação de negar por padrão e validar permissões a cada requisição da [OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html). Os pontos de integração são os [hooks do Fastify](https://fastify.dev/docs/latest/Reference/Hooks/).

## Sessão, banco e pipeline

A implementação adiada entrega o JWT de acesso no JSON e o token de renovação em cookie `HttpOnly`, `SameSite=Strict` e `Secure` em produção. Inclui renovação com rotação, logout, expiração, revogação e proteção CSRF. O frontend de login ainda precisa ser implementado, incluindo a coordenação de renovações entre requisições e abas.

O login de leitura da Gold é uma identidade técnica do backend e continua sem permissão de escrita. O schema `app` terá roles separadas para manutenção e uso HTTP. A pipeline precisa preservar esse schema e o volume do banco ao reconstruir a Gold. As tabelas da aplicação são criadas por migrações do backend; adicionar autenticação não exige, por si só, mudar o Docker Compose da pipeline.

Um administrador autorizado solicitará uma execução ao mecanismo de integração do ETL, ainda a definir. A API não entregará credenciais de carga ao navegador nem aceitará comandos arbitrários de shell. As solicitações terão auditoria com identidade, ação, execução e resultado, sem registrar senhas ou tokens.

## Ordem de implementação e aceite

1. Atualizar e revisar as branches adiadas contra a `main`, preservando todas as consultas públicas.
2. Revalidar migrações de `app`, criação do administrador, sessões, permissões e a demonstração automatizada.
3. Integrar primeiro o backend de autenticação e depois a automação da demonstração.
4. Implementar login, recuperação de sessão e logout no frontend.
5. Integrar permissões e auditoria às futuras rotas do ETL antes de disponibilizar seus controles.

Testes necessários: consultas públicas sem login; rejeição de chamadas administrativas anônimas; rejeição de conta autenticada sem permissão; sessão expirada ou revogada; tentativa de forjar perfil no cliente; acesso permitido ao administrador; proteção contra CSRF; ausência de credenciais nos logs; impedimento de reprocessamentos duplicados. A autorização administrativa deve estar pronta antes de expor a função de reprocessamento.
