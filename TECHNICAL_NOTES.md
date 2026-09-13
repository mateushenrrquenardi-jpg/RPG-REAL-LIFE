# Notas técnicas

- `js/rules.js` concentra regras determinísticas que possuem testes nativos do Node.
- O navegador lê dados diretamente apenas quando permitido; escritas sensíveis usam RPCs com `security definer`, escopo de `auth.uid()` e validação de domínio.
- Consultas de linha do tempo e loja são limitadas; o painel usa `get_hero_overview()` para agregados, evitando carregar o histórico inteiro.
- Os parâmetros de versão nos scripts e estilos são atualizados a cada release para impedir cache antigo no GitHub Pages.
- Avatares continuam nos metadados do Auth por compatibilidade. Uma futura migração para Supabase Storage deve preservar esse fallback até todos os perfis serem migrados.
