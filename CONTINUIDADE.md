# Contexto de continuidade

## Objetivo concluido

O antigo backend Google Sheets foi removido em favor de um banco de dados inteiramente versionado no GitHub.

## Arquitetura atual

| Componente | Papel |
| --- | --- |
| `data/database.json` | Banco unico: heroi, quests e historico. |
| `db.js` | Leitura publica via Raw GitHub e escrita autenticada via Contents API. |
| `app.js` | Interface assincrona; aguarda cada gravacao antes de atualizar a tela. |
| `index.html` | Campo de token e a interface do usuario. |

O token fine-grained do GitHub fica somente no `localStorage` da pessoa usuaria. Nunca coloque token, chave ou segredo em arquivo versionado.

## Validacoes recomendadas

1. Execute `node --check db.js` e `node --check app.js`.
2. Publique na `main` e confirme que o GitHub Pages carregou a nova versao.
3. No site, configure um token limitado ao repositorio com `Contents: Read and write`.
4. Adicione, conclua e remova uma quest; confirme que cada acao criou commit e atualizou `data/database.json`.
5. Exporte e importe um backup JSON de teste.

## Observacao de escala

GitHub Pages + Contents API e apropriado para este RPG pessoal e ganha versionamento/backup. Nao e um banco transacional de alto volume: muitas gravacoes simultaneas podem conflitar. `db.js` busca o SHA mais recente e tenta novamente tres vezes para reduzir esse risco. Caso o produto cresca para muitos usuarios simultaneos, a proxima evolucao deve ser uma API com autenticacao e banco dedicado.

## Prompt de retomada

> Estou mantendo o repositorio `mateushenrrquenardi-jpg/RPG-REAL-LIFE`, um GitHub Pages estatico. O banco inteiro fica em `data/database.json`; `db.js` le pelo Raw GitHub e grava pela GitHub Contents API usando um fine-grained token armazenado somente no localStorage. Leia `README.md` e `CONTINUIDADE.md`, preserve essa arquitetura e nunca versione tokens. Antes de alterar, execute `git status`; depois valide `node --check db.js` e `node --check app.js`. Explique e documente qualquer mudanca.
