# Executar o painel na EC2 para testes de carga

O Dockerfile da raiz compila os dois pacotes com o lockfile do projeto. Na imagem final, o Fastify roda como usuário `node`, serve o React compilado e atende `/api` na mesma porta. O PostgreSQL com a Gold e a pipeline têm ciclos de execução próprios. As credenciais entram na criação do container.

## Preparar a imagem

Execute na raiz do checkout que contém o Dockerfile e a versão que será medida. Para medir o ranking, use um commit que já inclua essa entrega. Use o hash curto desse commit como etiqueta no lugar de `ensaio-01` para registrar qual código produziu cada resultado.

```sh
docker build -t evasao-mt:ensaio-01 .
```

O build assume a arquitetura da máquina que o executa. Pode ser feito na própria EC2 com Docker e acesso aos registros de pacotes. Para levar uma imagem já construída de outro computador, escolha a plataforma da instância no build (`--platform linux/amd64` para x86-64 ou `--platform linux/arm64` para Graviton). Exemplo de transporte por SSH, com o usuário e o endereço da sua instância:

```sh
docker save -o evasao-mt.tar evasao-mt:ensaio-01
scp evasao-mt.tar usuario@host-ec2:~/evasao-mt.tar
```

Na EC2, execute `docker load -i ~/evasao-mt.tar`. O arquivo transporta a imagem. Prepare a conexão com o banco diretamente na instância.

## Conectar a Gold

Na EC2, crie o arquivo com `install -m 600 /dev/null ~/evasao-mt.env` no primeiro uso. Edite-o com os valores do banco do ensaio. O exemplo usa a credencial de leitura das tabelas da Gold e exercita o painel público.

```dotenv
POSTGRES_HOST=dns-privado-do-postgres
POSTGRES_PORT=5432
POSTGRES_DB=tcc
POSTGRES_USER=tcc_api
POSTGRES_PASSWORD=substitua-pela-senha
AUTH_ENABLED=false
HTTP_RATE_LIMIT_MAX=120
```

Se o PostgreSQL estiver em outra instância, permita a conexão na porta do banco a partir do grupo de segurança da EC2 da aplicação. Se estiver em outro container na mesma EC2, conecte a aplicação à rede Docker dele com `--network NOME_DA_REDE` e use o nome do serviço em `POSTGRES_HOST`. Dentro do container, `127.0.0.1` aponta para a própria aplicação. O serviço requer a Gold carregada e os grants descritos no [README do backend](../../backend/README.md). Para cargas reais, confirme com o responsável pelo SEDAP+ as condições de uso e armazenamento na nuvem.

## Iniciar e verificar

Defina o endereço IPv4 **privado da interface da EC2** para publicar a porta. No grupo de segurança, permita TCP 3000 a partir do grupo de segurança da máquina geradora de carga na VPC. Para uma conferência apenas na própria instância, use `IP_APP=127.0.0.1`.

```sh
IP_APP=10.0.1.25  # substitua pelo IP privado da instância
docker run -d --name evasao-mt --restart unless-stopped \
  --env-file "$HOME/evasao-mt.env" \
  -p "${IP_APP}:3000:3000" evasao-mt:ensaio-01
curl -fsS "http://${IP_APP}:3000/health"
curl -fsS "http://${IP_APP}:3000/api/v1/filtros"
docker logs --tail 30 evasao-mt
```

O primeiro endereço retorna `{"status":"ok"}` quando a API consegue ler a Gold. Um `503` indica que é preciso conferir rede, conexão e permissões antes de medir. Abra `/` para verificar o painel. A imagem define `NODE_ENV=production` e executa o build do React.

## Registrar o ensaio

Rode o gerador de carga em outra máquina e use o endereço privado da aplicação. Registre o commit, o ID da imagem (`docker image inspect --format '{{.Id}}' evasao-mt:ensaio-01`), o tipo da instância, o banco, o volume da Gold, a duração, a concorrência e a cota configurada. Para cada rota, registre os tempos das respostas bem-sucedidas, a proporção em até três segundos e, separadamente, respostas 429, falhas e timeouts. A cota padrão é compartilhada pelas rotas da API por IP e por processo. Para o ensaio de capacidade com outra cota, ajuste o arquivo, recrie o container e registre o novo valor. [Proteção da API](SEGURANCA_API.md).
