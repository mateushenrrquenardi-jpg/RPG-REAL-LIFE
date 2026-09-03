# RPG da Vida Real

RPG pessoal publicado no GitHub Pages, com dados em PostgreSQL no Supabase.

**Site:** https://mateushenrrquenardi-jpg.github.io/RPG-REAL-LIFE/

## Arquitetura

- **GitHub Pages:** interface estatica.
- **Supabase Auth:** conta e sessao da pessoa usuaria.
- **Supabase Postgres:** tabelas `profiles`, `quests` e `history`.
- **Row Level Security:** cada conta le e altera somente os seus proprios dados.

Nao ha token do GitHub nem senha do banco no navegador. A unica chave presente no codigo e a chave publica do projeto Supabase; as politicas do banco protegem os dados.

## Uso

1. Abra o site e crie uma conta com email e senha (minimo de seis caracteres).
2. Confirme o email, se o Supabase solicitar.
3. Entre com a conta criada e gerencie as quests.

Cada conclusao de quest e calculada em uma unica transacao no PostgreSQL: atualiza quest, EXP, atributos, nivel e historico sem risco de conflito entre cliques.

## Backup

Na aba **Config**, use **Exportar dados (JSON)** para baixar uma copia de seus dados. O reset afeta somente a conta logada.

## Desenvolvimento

Nao ha build. Para testar localmente, sirva a pasta por HTTP. O deploy ocorre automaticamente ao enviar commits para a branch `main`.
