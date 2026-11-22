# Acesso ao painel e à administração

Decisão de produto confirmada em **22/11/2026**: o painel será público; a administração exigirá login e autorização. Este documento define o desenho para um próximo incremento. Autenticação, sessões e rotas administrativas ainda não estão implementadas. A aplicação atual continua acessível somente em `127.0.0.1`.

## Quem pode fazer o quê

| Recurso | Visitante sem login | Administrador autenticado |
| --- | --- | --- |
| Consultar catálogo, resumo e evolução temporal | Permitido | Permitido |
| Acessar o painel e seus arquivos públicos | Permitido | Permitido |
| Consultar o estado mínimo em `/health` | Permitido | Permitido |
| Consultar histórico e detalhes do ETL | Negado | Permitido com `etl:consultar` |
| Solicitar reprocessamento do ETL | Negado | Permitido com `etl:reprocessar` |

As duas últimas linhas são funcionalidades planejadas. O Swagger continua disponível apenas em desenvolvimento. O fato de o painel ser público não concede acesso direto ao PostgreSQL, aos arquivos da pipeline ou às credenciais de carga.

## Autenticação e autorização

Autenticação identifica a pessoa; autorização decide quais ações ela pode executar. A proposta inicial é usar login por um provedor OpenID Connect e manter uma sessão segura da aplicação para a área administrativa. O provedor e a biblioteca serão escolhidos no incremento de segurança, conforme o ambiente de implantação; nenhuma dependência foi adicionada agora.

O perfil `administrador` receberá explicitamente as permissões `etl:consultar` e `etl:reprocessar`. Entrar com uma conta válida não concederá esse perfil automaticamente. A criação do primeiro administrador e a concessão ou revogação de acesso precisarão de um procedimento controlado; não haverá autocadastro público de administradores.

O backend obterá a identidade de uma sessão validada e consultará permissões confiáveis no servidor. Valores como `admin=true`, cabeçalhos personalizados, parâmetros da URL ou estado do React não serão aceitos como fonte de permissão.

## Aplicação das regras no Fastify

O controle será transversal, registrado antes dos módulos protegidos. As rotas públicas terão uma classificação explícita; as demais serão negadas quando não houver uma regra de acesso válida. Um hook verificará a sessão e outro verificará a permissão exigida pela operação, antes do handler.

Essas verificações devem ocorrer em **toda requisição protegida**, inclusive quando a URL for chamada diretamente fora do frontend. Sessão ausente, inválida ou expirada retornará `401`; identidade válida sem a permissão necessária retornará `403`. O tratamento global de erros precisará preservar esses códigos, em vez de convertê-los em `500`.

O frontend poderá ocultar controles administrativos para melhorar a navegação, mas a decisão de acesso será sempre do servidor. Isso segue a orientação de negar por padrão e validar permissões a cada requisição da [OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html). Os pontos de integração são os [hooks do Fastify](https://fastify.dev/docs/latest/Reference/Hooks/).

## Sessão, banco e pipeline

A proposta de sessão usa cookie `HttpOnly`, `Secure` em produção e política `SameSite` apropriada. Logout, expiração e revogação devem ser tratados, e operações que alteram estado precisam de proteção contra CSRF. Detalhes serão definidos e testados junto da implementação da sessão.

O login de leitura da Gold é uma identidade técnica do backend; ele não representa um visitante ou administrador. Ele continuará sem permissões de escrita na Gold. Caso contas, perfis ou sessões precisem de persistência local, seus dados ficarão em um schema próprio da aplicação, fora da Gold recriada pela pipeline, com credenciais e migrações adequadas a essa responsabilidade.

Um administrador autorizado solicitará uma execução ao mecanismo de integração do ETL, ainda a definir. A API não entregará credenciais de carga ao navegador nem aceitará comandos arbitrários de shell. As solicitações terão auditoria com identidade, ação, execução e resultado, sem registrar senhas ou tokens.

## Ordem de implementação e aceite

1. Escolher e configurar o provedor de identidade e o mecanismo de sessão.
2. Implementar autenticação e concessão controlada do perfil administrativo.
3. Implementar as verificações transversais e respostas `401`/`403`.
4. Integrar as permissões às rotas administrativas e registrar auditoria.
5. Disponibilizar a interface administrativa após os controles do backend.

Testes necessários: consultas públicas sem login; rejeição de chamadas administrativas anônimas; rejeição de conta autenticada sem permissão; sessão expirada ou revogada; tentativa de forjar perfil no cliente; acesso permitido ao administrador; proteção contra CSRF; ausência de credenciais nos logs; impedimento de reprocessamentos duplicados. A autorização administrativa deve estar pronta antes de expor a função de reprocessamento.
