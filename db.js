const db = (() => {
  const OWNER = "mateushenrrquenardi-jpg", REPO = "RPG-REAL-LIFE", BRANCH = "main";
  const FILE = "data/database.json", TOKEN_KEY = "rpg_github_token";
  const DEFAULT = { hero: { nivel: 1, exp_atual: 0, exp_necessaria: 100, forca: 0, magia: 0, carisma: 0, inteligencia: 0 }, quests: [], historico: [] };
  let cache = null;
  const copy = (value) => JSON.parse(JSON.stringify(value));
  const normalize = (value) => ({ hero: { ...DEFAULT.hero, ...(value?.hero || {}) }, quests: Array.isArray(value?.quests) ? value.quests : [], historico: Array.isArray(value?.historico) ? value.historico : [] });
  const rawUrl = () => `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${FILE}?v=${Date.now()}`;
  const apiUrl = () => `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE}`;
  const getToken = () => localStorage.getItem(TOKEN_KEY) || "";
  const hasToken = () => Boolean(getToken());
  function setToken(token) { const clean = token.trim(); if (clean) localStorage.setItem(TOKEN_KEY, clean); else localStorage.removeItem(TOKEN_KEY); }
  async function read() { const response = await fetch(rawUrl(), { cache: "no-store" }); if (!response.ok) throw new Error(`Nao foi possivel ler o banco (HTTP ${response.status}).`); cache = normalize(await response.json()); return copy(cache); }
  async function readWithSha() {
    const response = await fetch(`${apiUrl()}?ref=${BRANCH}`, { headers: { Authorization: `Bearer ${getToken()}`, Accept: "application/vnd.github+json" } });
    if (!response.ok) { const error = await response.json().catch(() => ({})); throw new Error(error.message || `Nao foi possivel acessar o banco (HTTP ${response.status}).`); }
    const file = await response.json();
    return { data: normalize(JSON.parse(decodeURIComponent(escape(atob(file.content.replace(/\n/g, "")))))), sha: file.sha };
  }
  const toBase64 = (text) => btoa(unescape(encodeURIComponent(text)));
  async function mutate(message, change) {
    if (!hasToken()) throw new Error("Configure um token do GitHub na aba Config para salvar alteracoes.");
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { data, sha } = await readWithSha();
      const result = change(data);
      const response = await fetch(apiUrl(), { method: "PUT", headers: { Authorization: `Bearer ${getToken()}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" }, body: JSON.stringify({ message: `rpg: ${message}`, content: toBase64(`${JSON.stringify(data, null, 2)}\n`), sha, branch: BRANCH }) });
      if (response.ok) { cache = normalize(data); return result; }
      if (![409, 422].includes(response.status)) { const error = await response.json().catch(() => ({})); throw new Error(error.message || `Nao foi possivel salvar (HTTP ${response.status}).`); }
    }
    throw new Error("O banco foi alterado em outro lugar. Tente novamente.");
  }
  async function init() { await read(); }
  async function getHero() { return copy((cache || await read()).hero); }
  async function getQuests() { return copy((cache || await read()).quests); }
  async function getHistorico() { return copy((cache || await read()).historico).reverse(); }
  async function addQuest(nome, tipo, atributo) { return mutate("adiciona quest", (data) => { const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`; data.quests.push({ id, nome, tipo, atributo, status: "ativa", data: new Date().toISOString() }); return { success: true, id }; }); }
  async function completeQuest(id) { return mutate("conclui quest", (data) => { const quest = data.quests.find((item) => item.id === id); if (!quest || quest.status === "concluida") return { error: "Quest nao encontrada ou ja concluida" }; quest.status = "concluida"; quest.data = new Date().toISOString(); const expGanho = quest.tipo === "principal" ? 30 : 10, pontos = quest.tipo === "principal" ? 3 : 1, hero = data.hero; hero.exp_atual += expGanho; if (Object.hasOwn(hero, quest.atributo)) hero[quest.atributo] += pontos; let levelUp = false; while (hero.exp_atual >= hero.exp_necessaria) { hero.exp_atual -= hero.exp_necessaria; hero.nivel += 1; hero.exp_necessaria = Math.round(hero.exp_necessaria * 1.2); levelUp = true; } data.historico.push({ data: new Date().toISOString(), acao: quest.nome, exp_ganho: expGanho, atributo: quest.atributo, pontos, nivel_atual: hero.nivel }); return { success: true, levelUp, nivel: hero.nivel, expGanho }; }); }
  async function deleteQuest(id) { return mutate("remove quest", (data) => { const before = data.quests.length; data.quests = data.quests.filter((quest) => quest.id !== id); return data.quests.length === before ? { error: "Quest nao encontrada" } : { success: true }; }); }
  async function resetDailies() { return mutate("reseta quests diarias", (data) => { let resetCount = 0; data.quests.forEach((quest) => { if (quest.tipo === "diaria" && quest.status === "concluida") { quest.status = "ativa"; resetCount += 1; } }); return { success: true, resetCount }; }); }
  async function exportAll() { return { ...copy(cache || await read()), exportedAt: new Date().toISOString() }; }
  async function importAll(value) { if (!value?.hero) return { error: "Arquivo JSON invalido. Deve conter 'hero'." }; const imported = normalize(value); return mutate("importa backup", (data) => { data.hero = imported.hero; data.quests = imported.quests; data.historico = imported.historico; return { success: true }; }); }
  async function resetAll() { return importAll(DEFAULT); }
  return { init, getHero, getQuests, getHistorico, addQuest, completeQuest, deleteQuest, resetDailies, exportAll, importAll, resetAll, getToken, setToken, hasToken };
})();
