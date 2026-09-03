# RPG da Vida Real

Aplicacao web estatica publicada no GitHub Pages, com dados salvos localmente no navegador (localStorage).

**[Acesse aqui →](https://mateushenrrquenardi-jpg.github.io/RPG-REAL-LIFE/)**

## Estrutura

```text
.
├── data/
│   └── default.json      # Dados iniciais do personagem
├── assets/
│   └── profile.jpg
├── db.js                  # Camada de dados (localStorage)
├── app.js                 # Logica da interface
├── index.html
├── styles.css
├── package.json
└── .gitignore
```

## Como funciona

### Armazenamento
- Os dados (heroi, quests, historico) ficam salvos no **localStorage** do navegador.
- Na primeira abertura, os dados iniciais sao carregados de `data/default.json`.
- Tudo e instantaneo — zero dependencia de APIs externas.

### Backup e restauracao
- Acesse a aba **Config** no app para:
  - **Exportar dados**: Baixa um arquivo JSON com todos os seus dados.
  - **Importar dados**: Carrega um arquivo JSON de backup.
  - **Resetar tudo**: Volta ao estado inicial (nivel 1, sem quests).

### Sistema de quests
| Tipo | EXP | Pontos de Atributo |
|---|---|---|
| Side quest | +10 | +1 |
| Missao principal | +30 | +3 |
| Diaria | +10 | +1 |

### Level-up
- A cada nivel, a EXP necessaria aumenta em 20% (`expNecessaria *= 1.2`).
- EXP inicial para o nivel 2: 100.

### Atributos
Forca (STR), Magia (MAG), Carisma (CAR), Inteligencia (INT).

## Desenvolvimento local

Basta abrir `index.html` no navegador. Nao ha dependencias de servidor ou build.

> **Nota**: Para testar o carregamento inicial de `data/default.json`, use um servidor local (ex: `npx serve .` ou a extensao Live Server do VS Code), pois `fetch` nao funciona com `file://`.

## Deploy

O projeto e publicado automaticamente pelo GitHub Pages a partir da branch `main`.

## Migrar dados entre dispositivos

1. No dispositivo de origem: aba **Config** → **Exportar dados**
2. Salve o arquivo JSON
3. No dispositivo de destino: aba **Config** → **Importar dados**
