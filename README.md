# RPG da Vida Real

Aplicacao web simples publicada no GitHub Pages, com dados em Google Sheets e API em Google Apps Script.

## Estrutura

```text
.
+-- apps-script/
|   +-- Code.gs
|   +-- appsscript.json
+-- assets/
|   +-- profile.jpg
+-- app.js
+-- index.html
+-- styles.css
+-- .clasp.json
+-- .gitignore
+-- package.json
```

## Fluxo oficial

O GitHub e a fonte oficial do codigo.

```text
desenvolvimento local
  -> GitHub
  -> clasp push
  -> Google Apps Script
  -> Google Sheets
```

Alteracoes feitas diretamente no editor do Google Apps Script devem ser sincronizadas com `clasp pull` antes de continuar o desenvolvimento local.

## Comandos

Requisito local: Node.js 20 ou superior com npm.

Instale as dependencias:

```bash
npm install
```

Faca login no Google para autorizar o clasp:

```bash
npx clasp login
```

Verifique diferencas entre o repositorio e o Apps Script:

```bash
npm run gas:status
```

Baixe a versao atual do Apps Script antes do primeiro push ou quando alguem editar pelo editor web:

```bash
npm run gas:pull
```

Envie alteracoes locais para o Apps Script:

```bash
npm run gas:push
```

Abra o projeto no editor do Google Apps Script:

```bash
npm run gas:open
```

## Cuidados

- Nao versionar credenciais, tokens, `.env`, `credentials.json`, `token.json` ou arquivos de service account.
- Antes do primeiro `gas:push`, execute `gas:pull` ou `gas:status` e compare o codigo remoto para evitar sobrescrever a API em producao.
- O Web App publicado usa o Apps Script existente. O arquivo `.clasp.json` aponta para o projeto atual pelo `scriptId`.
