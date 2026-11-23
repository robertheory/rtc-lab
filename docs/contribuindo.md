# Contribuindo com cenários

Os cenários aparecem no seletor **Carregar cenário** da aba Operação de cada motor (agrupados por `category`). Os que usam outros endpoints (XML, base de cálculo) aparecem como exemplos nas ferramentas da aba Consultas.

Os cenários são dados: um manifesto por motor e um arquivo de payload por cenário, versionados junto ao projeto. Não é preciso alterar código para adicionar um.

## Onde ficam

```
apps/web/public/scenarios/
├── regular/   manifest.json  payloads/
├── simples/   manifest.json  payloads/
└── danfse/    manifest.json  payloads/
```

## Regras

1. **Nada inventado.** Prefira payloads dos exemplos oficiais (testes e `docs/exemplos.md` dos repositórios). Se montar um novo a partir do contrato OpenAPI, ele precisa ser validado contra o motor real antes de entrar.
2. **Registre a origem** no campo `source` (repositório, tag, caminho do arquivo e, se adaptado, uma nota).
3. **Declare o esperado** em `expected`, com o comportamento que o motor real produz hoje.
4. **Sem dados pessoais.** Use apenas dados fictícios ou de exemplos públicos.
5. **Textos em português.** Nomes, descrições e explicações.

## Formato do manifesto

```json
{
  "id": "cesta-basica",
  "name": "Cesta básica com redução",
  "description": "Frase curta exibida no card.",
  "category": "reducao-tributaria",
  "method": "POST",
  "endpoint": "/calculadora/regime-geral",
  "contentType": "application/json",
  "payload": "cesta-basica.json",
  "explanation": "O que o cenário demonstra.",
  "expected": { "status": 200, "summary": "Resultado esperado." },
  "source": { "repository": "calculadora-rtc-regime-regular", "tag": "1.7.2", "path": "docs/exemplos.md", "note": "" }
}
```

- `endpoint` é relativo ao `basePath` do motor (`/api/regular`, `/api/simples`, `/api/danfse`) e pode conter query string.
- `query` (opcional) acrescenta parâmetros. O DANFSe usa `stc` (0, 1 ou 2) e `canhoto` (`true` ou `false`).
- `expected.estadoItens` (opcional) lista o `estadoItem` de cada item da resposta, na ordem.
- `expected.contentType` (opcional) é usado para o PDF do DANFSe (`application/pdf`).
- `category` aceita os valores já usados (`basico`, `reducao-tributaria`, `imposto-seletivo`, `observabilidade`, `consulta`, `xml`, `erro`, `situacao`, `completo`, `tratamento-diferenciado`, `multiplos-itens`). Uma categoria nova aparece com o próprio nome.
- `id` precisa ser único dentro do motor.

## Passo a passo

1. Salve o payload em `payloads/`.
2. Adicione o objeto ao `manifest.json` do motor.
3. Suba a stack (`docker compose up --build -d`) e rode:

   ```bash
   cd tests && npm ci && npm run integration
   ```

   O teste `scenarios.test.ts` executa **todos** os cenários contra o motor real e compara com `expected`. Se falhar, ou o payload está errado ou o `expected` não reflete o motor.
4. Abra http://localhost, carregue o cenário no seletor, execute e confira os textos.
5. Se o cenário nasceu de um exemplo oficial, confira se o exemplo ainda existe na versão fixada do motor.
