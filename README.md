# RPG da Vida Real

Aplicacao estatica publicada no GitHub Pages. O banco de dados esta integralmente no proprio repositorio, no arquivo [`data/database.json`](data/database.json).

**Site:** https://mateushenrrquenardi-jpg.github.io/RPG-REAL-LIFE/

## Como o banco funciona

- Leitura: o site baixa `data/database.json` diretamente do GitHub.
- Escrita: cada alteracao feita no site atualiza esse mesmo arquivo pela GitHub Contents API e cria um commit no repositorio.
- O arquivo contem `hero`, `quests` e `historico`; portanto o historico de commits tambem e um backup/auditoria dos dados.
- O token nunca e salvo no repositorio. Ele fica apenas no `localStorage` do navegador em que foi informado.

## Primeiro uso: habilitar gravacao

1. No GitHub, abra **Settings → Developer settings → Personal access tokens → Fine-grained tokens** e crie um token.
2. Limite o token ao repositorio `mateushenrrquenardi-jpg/RPG-REAL-LIFE`.
3. Em **Repository permissions**, conceda **Contents: Read and write**. Nao conceda outras permissoes.
4. Copie o token, abra o site, va em **Config**, cole-o no campo e use **Salvar token neste navegador**.
5. Crie uma quest de teste. Ela deve aparecer como um novo commit no GitHub em poucos segundos.

O token e necessario em cada navegador/dispositivo que possa alterar dados. Sem ele, o site continua exibindo os dados, mas bloqueia gravacoes. Para remove-lo do dispositivo, deixe o campo vazio e clique em salvar.

## Migrar dados que estavam no navegador antigo

1. Antes desta atualizacao, abra o site no navegador que possui os dados antigos e use **Config → Exportar dados (JSON)**.
2. Depois de publicar esta versao, configure o token conforme acima.
3. Use **Config → Importar dados (JSON)** e escolha o backup. Isso substitui o conteudo de `data/database.json` por seus dados anteriores.

## Backup e recuperacao

- **Backup manual:** use **Exportar dados (JSON)** na aba Config.
- **Recuperar uma versao:** no GitHub, abra o historico de `data/database.json`, copie o conteudo da revisao desejada e grave-o novamente pelo site (importando um JSON), ou reverta o commit no GitHub.
- **Resetar:** o botao da aba Config substitui todo o banco por um personagem novo. E uma operacao destrutiva, mas ainda pode ser revertida pelo historico Git.

## Desenvolvimento e deploy

Nao ha dependencias nem build. Para testar localmente, sirva a pasta com um servidor HTTP, por exemplo `npx serve .`. O GitHub Pages publica automaticamente os commits da branch `main`.

## Continuidade para outra IA ou outro dia

O documento de contexto e [`CONTINUIDADE.md`](CONTINUIDADE.md). Ele inclui arquitetura, arquivos importantes, validacoes e um prompt de retomada.
