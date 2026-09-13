(function exposeRpgConfig(root) {
  const config = Object.freeze({
    TITLES: Object.freeze([[1, "Iniciante"], [5, "Aventureiro"], [10, "Guerreiro"], [15, "Campeao"], [20, "Heroi"], [30, "Lendario"], [50, "Mitico"]]),
    ROUTINE_LEVELS: Object.freeze([
      { name: "Reconhecendo o padrao", days: 14 },
      { name: "Menos esforco consciente", days: 28 },
      { name: "Protocolo automatico", days: 60 },
      { name: "Parte do seu sistema", days: 90 },
      { name: "Rotina incorporada", days: 180 },
    ]),
    SHOP_CATEGORIES: Object.freeze(["Recovery", "Consumables", "Upgrades", "High-Tier"]),
    SHOP_PRODUCTS: Object.freeze([
      { id: "neural-brew", name: "Café especial", code: "Neural Brew", category: "Recovery", price: 60, description: "Uma recarga curta para restaurar o foco.", rarity: "Common" },
      { id: "system-pause", name: "1h de lazer livre", code: "System Pause", category: "Recovery", price: 70, description: "Uma hora sem culpa, fora do protocolo.", rarity: "Common" },
      { id: "night-protocol", name: "Noite de filme/série", code: "Night Protocol", category: "Recovery", price: 100, description: "Sessão de descanso audiovisual liberada.", rarity: "Rare" },
      { id: "street-fuel", name: "Lanche/delivery", code: "Street Fuel", category: "Consumables", price: 160, description: "Combustível de rua para uma refeição especial.", rarity: "Rare" },
      { id: "personal-cache", name: "Compra pessoal", code: "Personal Cache", category: "Consumables", price: 220, description: "Compra pessoal com limite real de até R$ 30,00.", realValue: 30, rarity: "Rare" },
      { id: "knowledge-chip", name: "Livro/ebook", code: "Knowledge Chip", category: "Upgrades", price: 300, description: "Novo módulo de conhecimento para o inventário.", rarity: "Epic" },
      { id: "family-run", name: "Passeio familiar", code: "Family Run", category: "Upgrades", price: 350, description: "Tempo de qualidade em uma missão com a família.", rarity: "Epic" },
      { id: "upgrade-pack", name: "Compra pessoal", code: "Upgrade Pack", category: "High-Tier", price: 650, description: "Compra pessoal com limite real de até R$ 100,00.", realValue: 100, rarity: "Epic" },
      { id: "tech-module", name: "Acessório tech/música", code: "Tech Module", category: "High-Tier", price: 1200, description: "Upgrade para seu ecossistema tech ou musical.", rarity: "Legendary" },
      { id: "prime-upgrade", name: "Compra maior planejada", code: "Prime Upgrade", category: "High-Tier", price: 2000, description: "Resgate de alto nível para uma compra planejada.", rarity: "Legendary" },
    ]),
  });
  root.RPG_CONFIG = config;
  if (typeof module !== "undefined") module.exports = config;
})(globalThis);
