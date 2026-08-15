const API_URL = "https://script.google.com/macros/s/AKfycbzDrLul734wj6q58L3d1tdENJMTnlcqQ1VisLwUdEeTr4xtjHz0dV_tArCU-466M74o/exec";

const TITLES = [
  [1, "Iniciante"],
  [5, "Aventureiro"],
  [10, "Guerreiro"],
  [15, "Campeao"],
  [20, "Heroi"],
  [30, "Lendario"],
  [50, "Mitico"],
];

const state = {
  quests: [],
  loading: false,
};

const $ = (selector) => document.querySelector(selector);

function getTitle(level) {
  let title = "Iniciante";
  for (const [minLevel, name] of TITLES) {
    if (Number(level) >= minLevel) title = name;
  }
  return title;
}

function capitalize(value) {
  const text = String(value || "");
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 3000);
}

function setBusy(button, busy, text) {
  if (!button) return;
  if (busy) {
    button.dataset.originalText = button.textContent;
    button.textContent = text || "Aguarde...";
    button.disabled = true;
    return;
  }
  button.textContent = button.dataset.originalText || button.textContent;
  button.disabled = false;
}

async function callApi(params) {
  const url = `${API_URL}?${new URLSearchParams(params)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Erro ${response.status}`);
  return response.json();
}

async function loadHero() {
  try {
    const hero = await callApi({ action: "getHero" });
    const current = Number(hero.exp_atual || 0);
    const needed = Number(hero.exp_necessaria || 1);
    const pct = Math.max(0, Math.min(100, Math.round((current / needed) * 100)));

    $("#exp-fill").style.width = `${pct}%`;
    $("#exp-val").textContent = `${current} / ${needed}`;
    $("#hero-class").textContent = `// ${getTitle(hero.nivel).toUpperCase()} - NV.${hero.nivel}`;
    $("#a-forca").textContent = hero.forca ?? "-";
    $("#a-magia").textContent = hero.magia ?? "-";
    $("#a-carisma").textContent = hero.carisma ?? "-";
    $("#a-intel").textContent = hero.inteligencia ?? "-";
  } catch (error) {
    showToast("Erro ao carregar o heroi.");
  }
}

async function loadQuests() {
  try {
    state.quests = await callApi({ action: "getQuests" });
    renderQuests();
  } catch (error) {
    $("#daily-list").innerHTML = `<p class="state-text">Erro ao carregar diarias.</p>`;
    $("#quest-list").innerHTML = `<p class="state-text">Erro ao carregar quests.</p>`;
    showToast("Erro ao carregar quests.");
  }
}

function renderQuests() {
  const dailyQuests = state.quests.filter((quest) => quest.tipo === "diaria");
  const activeQuests = state.quests.filter((quest) => quest.tipo !== "diaria" && quest.status === "ativa");
  const completedDaily = dailyQuests.filter((quest) => quest.status === "concluida").length;

  $("#daily-summary").textContent = dailyQuests.length
    ? `${completedDaily}/${dailyQuests.length} concluidas hoje`
    : "Nenhuma diaria cadastrada ainda.";

  $("#daily-list").innerHTML = dailyQuests.length
    ? dailyQuests.map(renderQuest).join("")
    : `<p class="state-text">Cadastre uma quest como diaria para ela aparecer aqui.</p>`;

  $("#quest-list").innerHTML = activeQuests.length
    ? activeQuests.map(renderQuest).join("")
    : `<p class="state-text">Nenhuma quest ativa.</p>`;
}

function renderQuest(quest) {
  const done = quest.status === "concluida";
  const isDaily = quest.tipo === "diaria";
  const typeClass = quest.tipo === "principal" ? "badge-main" : isDaily ? "badge-daily" : "";
  const typeLabel = quest.tipo === "principal" ? "Principal" : isDaily ? "Diaria" : "Side";
  const statusClass = done ? "badge-done" : "badge-pending";
  const statusLabel = done ? "Concluida" : "Pendente";

  return `
    <article class="quest-item ${done ? "done" : ""}">
      <div class="quest-main">
        <div class="quest-title">${escapeHtml(quest.nome)}</div>
        <div class="quest-meta">
          <span class="badge ${typeClass}">${typeLabel}</span>
          <span class="badge">${escapeHtml(capitalize(quest.atributo))}</span>
          <span class="badge ${statusClass}">${statusLabel}</span>
        </div>
      </div>
      <div class="quest-actions">
        <button class="btn btn-complete" type="button" data-action="complete" data-id="${escapeHtml(quest.id)}" ${done ? "disabled" : ""}>
          ${done ? "Feita" : "Concluir"}
        </button>
        <button class="btn btn-delete" type="button" data-action="delete" data-id="${escapeHtml(quest.id)}" aria-label="Remover quest">
          X
        </button>
      </div>
    </article>
  `;
}

async function addQuest(event) {
  event.preventDefault();

  const nameInput = $("#q-nome");
  const nome = nameInput.value.trim();
  const tipo = $("#q-tipo").value;
  const atributo = $("#q-atrib").value;

  if (!nome) {
    showToast("Digite o nome da quest.");
    return;
  }

  const button = event.submitter;
  setBusy(button, true, "Salvando...");

  try {
    const result = await callApi({ action: "addQuest", nome, tipo, atributo });
    if (result?.error) throw new Error(result.error);
    nameInput.value = "";
    showToast("Quest adicionada.");
    await loadQuests();
  } catch (error) {
    showToast("Erro ao adicionar quest.");
  } finally {
    setBusy(button, false);
  }
}

async function completeQuest(id, button) {
  setBusy(button, true, "Enviando...");

  try {
    const result = await callApi({ action: "completeQuest", id });
    if (result?.error) {
      showToast(`Erro: ${result.error}`);
      return;
    }

    if (result?.levelUp) {
      showToast(`Level up! NV.${result.nivel} - ${getTitle(result.nivel)}`);
    } else {
      showToast(`+${result.expGanho || 0} EXP`);
    }

    await Promise.all([loadHero(), loadQuests()]);
  } catch (error) {
    showToast("Erro ao concluir quest.");
  } finally {
    setBusy(button, false);
  }
}

async function deleteQuest(id, button) {
  const confirmed = window.confirm("Remover esta quest?");
  if (!confirmed) return;

  setBusy(button, true, "...");

  try {
    const result = await callApi({ action: "deleteQuest", id });
    if (result?.error) throw new Error(result.error);
    showToast("Quest removida.");
    await loadQuests();
  } catch (error) {
    showToast("Erro ao remover quest.");
  } finally {
    setBusy(button, false);
  }
}

async function resetDailies(button) {
  setBusy(button, true, "Resetando...");

  try {
    const result = await callApi({ action: "resetDailies" });
    if (result?.error) throw new Error(result.error);
    showToast("Diarias resetadas. Novo ciclo iniciado.");
    await loadQuests();
  } catch (error) {
    showToast("Erro ao resetar diarias.");
  } finally {
    setBusy(button, false);
  }
}

async function loadHistory() {
  const list = $("#hist-list");
  list.innerHTML = `<p class="state-text">Carregando registros...</p>`;

  try {
    const history = await callApi({ action: "getHistorico" });

    list.innerHTML = history.length
      ? history.slice(0, 50).map(renderHistoryItem).join("")
      : `<p class="state-text">Nenhum registro ainda.</p>`;
  } catch (error) {
    list.innerHTML = `<p class="state-text">Erro ao carregar log.</p>`;
    showToast("Erro ao carregar log.");
  }
}

function renderHistoryItem(item) {
  return `
    <article class="history-item">
      <div class="history-title">${escapeHtml(item.acao)}</div>
      <div class="history-meta">
        <span class="badge">+${escapeHtml(item.exp_ganho)} EXP</span>
        <span class="badge">+${escapeHtml(item.pontos)} ${escapeHtml(String(item.atributo || "").toUpperCase())}</span>
        <span class="badge">NV.${escapeHtml(item.nivel_atual)}</span>
        <span class="badge">${escapeHtml(formatDate(item.data))}</span>
      </div>
    </article>
  `;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function showTab(tabName) {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === tabName);
  });

  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `tab-${tabName}`);
  });

  if (tabName === "historico") loadHistory();
}

function bindEvents() {
  $("#quest-form").addEventListener("submit", addQuest);
  $("#btn-new-day").addEventListener("click", (event) => resetDailies(event.currentTarget));
  $("#btn-reset-dailies").addEventListener("click", (event) => resetDailies(event.currentTarget));

  document.querySelector(".tabs").addEventListener("click", (event) => {
    const tab = event.target.closest("[data-tab]");
    if (tab) showTab(tab.dataset.tab);
  });

  document.body.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    const id = button.dataset.id;
    if (button.dataset.action === "complete") completeQuest(id, button);
    if (button.dataset.action === "delete") deleteQuest(id, button);
  });
}

async function init() {
  bindEvents();
  await Promise.all([loadHero(), loadQuests()]);
}

init();
