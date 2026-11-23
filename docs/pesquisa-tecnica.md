# Pesquisa técnica

Achados da leitura dos três repositórios oficiais e as decisões que deles decorrem. A documentação e o código oficiais são a fonte de verdade. Onde este documento divergir deles, vale o oficial.

> O RTC Lab é um projeto independente. Não é um sistema oficial da Receita Federal.

## Versões fixadas

| Motor | Repositório | Tag | Commit |
|---|---|---|---|
| Regime Regular | [calculadora-rtc-regime-regular](https://github.com/ReceitaFederal/calculadora-rtc-regime-regular) | `1.7.2` | `32df719` |
| Simples Nacional | [calculadora-rtc-simples-nacional](https://github.com/ReceitaFederal/calculadora-rtc-simples-nacional) | `1.0.2` | `f90b652` |
| Gerador DANFSe | [calculadora-rtc-gerador-danfse](https://github.com/ReceitaFederal/calculadora-rtc-gerador-danfse) | `1.0.0` | `8d79e6b` |

Os três são MIT. Os submodules apontam para as tags de release, não para a ponta da `main` (que tem commits de merge posteriores).

## Resumo por motor

| | Regime Regular | Simples Nacional | DANFSe |
|---|---|---|---|
| Runtime | Java 25, Spring Boot 4.1.2 | Java 25, Spring Boot 4.1.2 | Go 1.27 (Echo v5) |
| Artefato | `target/api-regime-geral.jar` | `target/api-simples-nacional.jar` | binário `danfse-service` |
| Porta da aplicação | 8080 | 8082 | 8080 |
| Context path | `/api` | `/api` | nenhum |
| Porta de saúde | 9101 (`/health`) | 9103 (`/health`) | mesma da aplicação (`/health/live`, `/health/ready`) |
| Versão | `GET /api/versao` | `GET /api/versao` | sem endpoint (usa-se a tag fixada) |
| OpenAPI | `/api/api-docs` (3.1) | `/api/api-docs` (3.1) | `api/swagger/swagger.yaml` (2.0) |
| Dockerfile oficial | não existe | não existe | existe, mas fixa `GOARCH=amd64` |
| Base de dados | SQLite somente leitura | a mesma do regular | nenhuma |

## Base de dados (ponto crítico)

- Os dois motores Java abrem `./calculadora/db/calculadora-pro.db` com `mode=ro`, relativo ao diretório de trabalho. **Sem a base, a aplicação não sobe.**
- A base não está no repositório. É gerada por Flyway, manualmente, e nunca na inicialização da aplicação.
- Os scripts ficam em `flyway/` do **regime regular**. O Simples Nacional não traz Flyway: o README dele manda copiar a pasta `flyway/` do regular. As migrações específicas do Simples (`V0047` a `V0071`) já fazem parte desse conjunto.
- Conclusão: **uma única base serve aos dois motores**.

### Como o RTC Lab prepara a base

O serviço `db-init` roda uma vez a cada `docker compose up`:

1. Calcula uma impressão digital (sha256) de todos os scripts Flyway.
2. Se a base existe em `./data/db` (pasta do repositório montada no container) e foi gerada para a mesma impressão digital, não faz nada.
3. Caso contrário executa `flyway:migrate` em um caminho temporário e move o resultado atomicamente para essa pasta. Uma falha nunca deixa uma base pela metade.

Os motores montam a pasta como somente leitura. Reiniciar não perde a base, e ela pode ser inspecionada localmente (`data/db/calculadora-pro.db`). Para forçar a regeneração, remova `calculadora-pro.db` e `.built-for` dessa pasta.

## Endpoints relevantes

### Regime Regular (`/api/calculadora/...`)

- Cálculo: `POST /regime-geral`, `POST /observabilidade/regime-geral`, `POST /pedagio`.
- Erros: `GET /observabilidade/erros?codigo=`.
- Base de cálculo: `POST /base-calculo/*` e `POST /nfse/*`.
- XML: `POST /xml/generate?tipo=`, `POST /xml/validate?tipo=&subtipo=`, `GET /xml/generate` e `GET /xml/validate` (tipos aceitos).
- Dados abertos (`GET /dados-abertos/...`): UFs, municípios, situações e classificações tributárias, NCM, NBS, alíquotas (`aliquota-uniao`, `aliquota-uf`, `aliquota-municipio`), fundamentações legais, versão.

### Simples Nacional (`/api/...`)

- `POST /calculadora/observabilidade/simples-nacional/nao-assistido`: **endpoint atual**. O README oficial não o lista.
- `POST /calculadora/observabilidade/simples-nacional`: marcado como obsoleto. Não é usado.
- `GET /calculadora/simples-nacional/atividades?data=` e `.../atividades/{codigo}`.
- `GET /calculadora/observabilidade/simples-nacional/erros?codigo=`.
- `GET /versao`.

### DANFSe

- `POST /api/danfse`: corpo é o **XML cru** (não é multipart nem JSON). Query `stc` (`0` normal, `1` substituída, `2` cancelada) e `canhoto` (`true` padrão, `false` oculta). Resposta `application/pdf`.
- Erros: JSON `{"sucesso": false, "mensagem": "..."}`. Erros internos também saem como status 400.
- Limite do corpo: 5 MiB por padrão (`XML_MAX_SIZE_BYTES`, teto de 32 MiB).

## Comportamentos que afetam a integração

- **Status HTTP no Simples:** `200` mesmo com erro em itens (veja `estadoItem` por item). `422` para erro global de validação.
- **CORS:** irrelevante aqui, pois tudo passa pelo Traefik na mesma origem.
- **Chamada externa na inicialização:** os dois motores Java consultam `piloto-cbs.tributos.gov.br` para comparar versões. Sem internet só aparece um aviso no log.
- **Telemetria:** o OpenTelemetry está no classpath. O RTC Lab a desativa por variáveis de ambiente.
- **JVM:** o CHANGELOG 1.0.1 do Simples cita a mitigação `-XX:-UseBASE64Intrinsics`. Aplicada aos dois motores Java.
- **Limite de corpo:** o regular limita a 500 KB em memória. A interface valida o tamanho antes de enviar.
- **Imagem Java:** a imagem `eclipse-temurin:25-jre` não traz `curl`. Os Dockerfiles próprios o instalam para os healthchecks.

## Exemplos oficiais disponíveis

- **Regime Regular:** muitos. `src/test/resources/entradas/**` e `docs/exemplos.md`.
- **Simples Nacional:** apenas dois payloads (NFS-e e NF-e), em constantes Java de `SimplesNacionalControllerOpenApi.java`. O `docs/exemplos.md` do repositório é herdado de outro projeto e não vale para o Simples.
- **DANFSe:** nenhum XML de exemplo. Só fixtures embutidas em testes Go.

## Decisões

| Decisão | Motivo |
|---|---|
| Submodules fixados em tag | Reprodutibilidade; nenhum arquivo oficial é alterado. |
| Dockerfiles próprios em `infrastructure/` | Os repositórios não trazem Dockerfile (ou, no DANFSe, fixam a arquitetura). |
| Uma base compartilhada, gerada por `db-init` | Dependência real entre os motores; idempotente e atômica. |
| Saúde real via actuator exposto só em `/health/<motor>` | Não declarar "saudável" só porque o container roda. `/metrics` fica de fora. |
| Sem backend próprio | Browser → Traefik → motores, conforme a especificação. |
| Interface sem framework (Vite + TypeScript + Bootstrap 5) | Simplicidade. Única biblioteca extra: CodeMirror 6 para os editores. |
| Cenários como dados, validados contra os motores reais | Nada de payload "supostamente válido". |
| Nenhum cálculo tributário próprio | Comparações mostram valores das respostas, sem derivar deltas. |

## Riscos conhecidos

- O tempo de inicialização e o consumo de memória dos motores Java não estão documentados. São medidos na prática e ajustados nos healthchecks.
- A construção das imagens exige internet (Maven Central, Go modules, Docker Hub).
- Sem um XML de NFS-e oficial no repositório do DANFSe, os XMLs de demonstração vêm de arquivos de teste do regime regular, validados contra o XSD e contra o próprio gerador.
- Máquinas Apple Silicon com `DOCKER_DEFAULT_PLATFORM=linux/amd64` exportado no shell rodam tudo sob emulação. Veja o README.
