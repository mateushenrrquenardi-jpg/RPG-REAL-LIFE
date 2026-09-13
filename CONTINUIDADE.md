# Continuidade técnica

## Fonte e publicação

- Diretório canônico: `_github_repo`.
- Branch de produção: `main`.
- Antes de publicar: `npm run verify`, revisão de migration necessária e incremento dos parâmetros de versão em `index.html`.

## Camadas

| Camada | Responsabilidade |
| --- | --- |
| `js/constants.js` | Constantes de títulos, rotinas e loja. |
| `js/rules.js` | Cálculo puro de percentuais e marcos de GOLD. |
| `db.js` | Autenticação e chamadas Supabase/RPC. |
| `app.js` | Interface, estado local e ligação de eventos. |
| `supabase/` | Migrations de esquema, regras e permissões. |

## Banco

- Nunca exponha chave `service_role`.
- Leitura é limitada por RLS; escrita crítica é feita por funções `security definer` com `auth.uid()`.
- `complete_quest`, `update_main_quest_progress`, `redeem_gold_reward`, `save_quest` e `save_custom_reward` são as operações de domínio.
- Consulte [supabase/MIGRATIONS.md](supabase/MIGRATIONS.md) antes de executar qualquer SQL.

## Checklist de regressão

1. `npm run verify`.
2. Login e logout.
3. Criar, editar, concluir e remover quest.
4. Registrar progresso de livro, curso e compra; conferir marcos de GOLD sem duplicação.
5. Criar e resgatar Custom Contract; conferir extrato e saldo.
6. Abrir Painel do Herói e validar agregados/linha do tempo.
7. Confirmar o site publicado sem cache antigo.
