/**
 * db.js — Camada de dados local usando localStorage.
 * Substitui completamente o Google Apps Script / Sheets.
 *
 * Chaves no localStorage:
 *   rpg_hero       → objeto JSON do herói
 *   rpg_quests     → array JSON de quests
 *   rpg_historico  → array JSON do histórico
 *   rpg_initialized → flag "1" indicando que os dados já foram carregados
 */

const DB_KEYS = {
  hero: "rpg_hero",
  quests: "rpg_quests",
  historico: "rpg_historico",
  initialized: "rpg_initialized",
};

const db = (() => {
  // ─── helpers internos ───────────────────────────────────────────

  function read(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  // ─── inicialização ─────────────────────────────────────────────

  /**
   * Carrega dados iniciais do `data/default.json` na primeira vez,
   * ou usa os dados que já estão no localStorage.
   */
  async function init() {
    if (localStorage.getItem(DB_KEYS.initialized) === "1") return;

    try {
      const resp = await fetch("data/default.json");
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const defaults = await resp.json();

      write(DB_KEYS.hero, defaults.hero);
      write(DB_KEYS.quests, defaults.quests || []);
      write(DB_KEYS.historico, defaults.historico || []);
      localStorage.setItem(DB_KEYS.initialized, "1");
    } catch (err) {
      // Se não conseguir carregar o JSON, cria dados mínimos
      console.warn("Não foi possível carregar default.json, usando fallback.", err);
      write(DB_KEYS.hero, {
        nivel: 1,
        exp_atual: 0,
        exp_necessaria: 100,
        forca: 0,
        magia: 0,
        carisma: 0,
        inteligencia: 0,
      });
      write(DB_KEYS.quests, []);
      write(DB_KEYS.historico, []);
      localStorage.setItem(DB_KEYS.initialized, "1");
    }
  }

  // ─── leitura ────────────────────────────────────────────────────

  function getHero() {
    return read(DB_KEYS.hero) || {
      nivel: 1,
      exp_atual: 0,
      exp_necessaria: 100,
      forca: 0,
      magia: 0,
      carisma: 0,
      inteligencia: 0,
    };
  }

  function getQuests() {
    return read(DB_KEYS.quests) || [];
  }

  function getHistorico() {
    const hist = read(DB_KEYS.historico) || [];
    return hist.slice().reverse();
  }

  // ─── escrita ────────────────────────────────────────────────────

  function addQuest(nome, tipo, atributo) {
    const quests = getQuests();
    const id = Date.now().toString();
    const data = new Date().toLocaleString("pt-BR");

    const quest = { id, nome, tipo, atributo, status: "ativa", data };
    quests.push(quest);
    write(DB_KEYS.quests, quests);

    return { success: true, id };
  }

  function completeQuest(id) {
    const quests = read(DB_KEYS.quests) || [];
    const hero = getHero();
    const historico = read(DB_KEYS.historico) || [];

    const quest = quests.find((q) => q.id === id);
    if (!quest) return { error: "Quest nao encontrada" };

    // Marcar como concluída
    quest.status = "concluida";
    quest.data = new Date().toLocaleString("pt-BR");

    // Calcular recompensas
    const expGanho = quest.tipo === "principal" ? 30 : 10;
    const pontosAtrib = quest.tipo === "principal" ? 3 : 1;

    hero.exp_atual += expGanho;

    // Incrementar atributo
    const atrib = quest.atributo.toLowerCase();
    if (atrib === "forca") hero.forca += pontosAtrib;
    else if (atrib === "magia") hero.magia += pontosAtrib;
    else if (atrib === "carisma") hero.carisma += pontosAtrib;
    else if (atrib === "inteligencia") hero.inteligencia += pontosAtrib;

    // Level-up
    let levelUp = false;
    while (hero.exp_atual >= hero.exp_necessaria) {
      hero.exp_atual -= hero.exp_necessaria;
      hero.nivel++;
      hero.exp_necessaria = Math.round(hero.exp_necessaria * 1.2);
      levelUp = true;
    }

    // Registrar no histórico
    historico.push({
      data: new Date().toLocaleString("pt-BR"),
      acao: quest.nome,
      exp_ganho: expGanho,
      atributo: quest.atributo,
      pontos: pontosAtrib,
      nivel_atual: hero.nivel,
    });

    // Salvar tudo
    write(DB_KEYS.quests, quests);
    write(DB_KEYS.hero, hero);
    write(DB_KEYS.historico, historico);

    return {
      success: true,
      levelUp,
      nivel: hero.nivel,
      expAtual: hero.exp_atual,
      expNec: hero.exp_necessaria,
      forca: hero.forca,
      magia: hero.magia,
      carisma: hero.carisma,
      inteligencia: hero.inteligencia,
      expGanho,
      pontosAtrib,
      atributo: quest.atributo,
    };
  }

  function deleteQuest(id) {
    let quests = read(DB_KEYS.quests) || [];
    const before = quests.length;
    quests = quests.filter((q) => q.id !== id);

    if (quests.length === before) return { error: "Quest nao encontrada" };

    write(DB_KEYS.quests, quests);
    return { success: true };
  }

  function resetDailies() {
    const quests = read(DB_KEYS.quests) || [];
    let resetCount = 0;

    for (const quest of quests) {
      if (quest.tipo === "diaria" && quest.status === "concluida") {
        quest.status = "ativa";
        resetCount++;
      }
    }

    write(DB_KEYS.quests, quests);
    return { success: true, resetCount };
  }

  // ─── export / import ───────────────────────────────────────────

  function exportAll() {
    return {
      hero: getHero(),
      quests: read(DB_KEYS.quests) || [],
      historico: read(DB_KEYS.historico) || [],
      exportedAt: new Date().toISOString(),
    };
  }

  function importAll(data) {
    if (!data || !data.hero) {
      return { error: "Arquivo JSON invalido. Deve conter ao menos 'hero'." };
    }

    write(DB_KEYS.hero, data.hero);
    write(DB_KEYS.quests, data.quests || []);
    write(DB_KEYS.historico, data.historico || []);
    localStorage.setItem(DB_KEYS.initialized, "1");

    return { success: true };
  }

  function resetAll() {
    localStorage.removeItem(DB_KEYS.hero);
    localStorage.removeItem(DB_KEYS.quests);
    localStorage.removeItem(DB_KEYS.historico);
    localStorage.removeItem(DB_KEYS.initialized);
  }

  // ─── API pública ───────────────────────────────────────────────

  return {
    init,
    getHero,
    getQuests,
    getHistorico,
    addQuest,
    completeQuest,
    deleteQuest,
    resetDailies,
    exportAll,
    importAll,
    resetAll,
  };
})();
