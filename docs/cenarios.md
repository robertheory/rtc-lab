# Catálogo de cenários

Todos os cenários são executados contra os motores reais pelos testes de integração. Nomes e o que cada um demonstra estão nos manifestos (`apps/web/public/scenarios/*/manifest.json`).

## Regime Regular

| Cenário | Endpoint | Esperado |
|---|---|---|
| Operação básica | `POST /calculadora/regime-geral` | 200 |
| Cesta básica com redução | `POST /calculadora/regime-geral` | 200 (simulado, 2027) |
| Operação com Imposto Seletivo | `POST /calculadora/regime-geral` | 200 |
| Serviço de educação | `POST /calculadora/regime-geral` | 200 |
| Erro proposital de classificação | `POST /calculadora/regime-geral` | 422 |
| Mesmo erro, com observabilidade | `POST /calculadora/observabilidade/regime-geral` | 200, `INCONSISTENCIA_ENTRADA` |
| Observabilidade com quatro itens | idem | 200, três simulados e um inconsistente |
| Observabilidade com seis itens | idem | 200, estados variados |
| Base de cálculo unificada | `POST /calculadora/base-calculo/base-calculo-unificada` | 200 |
| Gerar XML tributário | `POST /calculadora/xml/generate?tipo=nfe` | 200 (XML) |
| Validar XML de NFS-e | `POST /calculadora/xml/validate?tipo=nfse&subtipo=nota` | 200 (`true`) |

## Simples Nacional

Todos usam `POST /calculadora/observabilidade/simples-nacional/nao-assistido`.

| Cenário | Esperado |
|---|---|
| NF-e básica (exemplo oficial) | 200, `CALCULADO` |
| NFS-e básica (exemplo oficial com NBS vigente) | 200, `CALCULADO` |
| Atividade sujeita ao Fator R | 200, `CALCULADO` (Anexo III) |
| Operação com múltiplos itens | 200, três `CALCULADO` |
| Erro: atividade desconhecida | 200, `NAO_CALCULADO` |
| Exemplo oficial de NFS-e (NBS desconhecida) | 200, `INCONSISTENCIA_ENTRADA` (VSN-050) |
| Erro global: NFS-e com dois itens | 422 |

## DANFSe

| Cenário | Opções | Esperado |
|---|---|---|
| NFS-e simples | `stc=0`, canhoto | PDF |
| NFS-e com mais informações (IBS/CBS) | `stc=0`, canhoto | PDF |
| NFS-e cancelada, sem canhoto | `stc=2`, `canhoto=false` | PDF com marca d'água CANCELADA |
| NFS-e substituída | `stc=1` | PDF com marca d'água SUBSTITUÍDA |

Os XMLs vêm de arquivos de teste do Regime Regular (`src/test/resources/xml/nfse/valido/nota/`), aceitos pela validação XSD do motor e pelo gerador. O repositório do DANFSe não traz XML de exemplo.
