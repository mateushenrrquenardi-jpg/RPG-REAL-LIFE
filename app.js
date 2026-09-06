const TITLES = [[1, "Iniciante"], [5, "Aventureiro"], [10, "Guerreiro"], [15, "Campeao"], [20, "Heroi"], [30, "Lendario"], [50, "Mitico"]];
const $ = (selector) => document.querySelector(selector);
const titleFor = (level) => TITLES.reduce((current, [minimum, title]) => Number(level) >= minimum ? title : current, "Iniciante");
const escapeHtml = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const ROUTINE_LEVELS = [
  { name: "Reconhecendo o padrao", days: 14 },
  { name: "Menos esforco consciente", days: 28 },
  { name: "Protocolo automatico", days: 56 },
  { name: "Parte do seu sistema", days: 91 },
  { name: "Rotina incorporada", days: 182 },
];

function calcCleanDays(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return null;
  const start = new Date(y, m - 1, d);
  start.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

function toast(message) { const el = $("#toast"); el.textContent = message; el.classList.add("show"); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove("show"), 3500); }
function busy(button, active, text = "Salvando...") { if (!button) return; if (active) { button.dataset.label = button.textContent; button.textContent = text; button.disabled = true; } else { button.textContent = button.dataset.label || button.textContent; button.disabled = false; } }
function setAppVisible(signedIn) { $("#auth-screen").hidden = signedIn; $("#app-screen").hidden = !signedIn; }

async function loadHero() {
  const [hero, cleanDate] = await Promise.all([
    db.getHero(),
    db.getCleanDate().catch(() => null),
  ]);
  const exp = Number(hero.exp_atual), need = Number(hero.exp_necessaria);
  $("#exp-fill").style.width = `${Math.max(0, Math.min(100, Math.round(exp / need * 100)))}%`;
  $("#exp-val").textContent = `${exp} / ${need}`;

  const days = calcCleanDays(cleanDate);
  const cleanBadge = days !== null ? ` • ${days === 1 ? "1 DIA LIMPO" : `${days} DIAS LIMPO`}` : "";
  $("#hero-class").textContent = `// ${titleFor(hero.nivel).toUpperCase()} - NV.${hero.nivel}${cleanBadge}`;

  $("#a-forca").textContent = hero.forca; $("#a-magia").textContent = hero.magia;
  $("#a-carisma").textContent = hero.carisma; $("#a-intel").textContent = hero.inteligencia;

  const cleanInput = $("#clean-date-input");
  if (cleanInput && cleanDate) cleanInput.value = cleanDate;
}

function routineHtml(quest) {
  const routine = quest.routine;
  if (!routine) return "";
  const levelIdx = Math.min(Math.max(Number(quest.routine_level || 1), 1), ROUTINE_LEVELS.length) - 1;
  const level = ROUTINE_LEVELS[levelIdx];
  const days = Math.min(Number(routine.routine_days || 0), level.days);
  const pct = Math.min(100, Math.round(days / level.days * 100));
  const fixed = routine.routine_fixed;
  const levelNum = String(quest.routine_level || 1).padStart(2, "0");
  const rankLabel = fixed ? "ROTINA FIXADA" : `Nivel ${levelNum} - ${level.name}`;
  return `<div class="routine-card ${fixed ? "routine-fixed" : ""}"><div class="routine-top"><span class="routine-rank">${rankLabel}</span><span>${days}/${level.days} DIAS</span></div><div class="routine-track" aria-label="Progresso da rotina"><div class="routine-fill" style="width:${pct}%"></div></div></div>`;
}

function questHtml(quest) {
  const done = quest.status === "concluida", daily = quest.tipo === "diaria";
  const label = quest.tipo === "principal" ? "Principal" : daily ? "Diaria" : "Side";
  const style = quest.tipo === "principal" ? "badge-main" : daily ? "badge-daily" : "";
  return `<article class="quest-item ${done ? "done" : ""}"><div class="quest-main"><div class="quest-title">${escapeHtml(quest.nome)}</div><div class="quest-meta"><span class="badge ${style}">${label}</span><span class="badge">${escapeHtml(quest.atributo[0].toUpperCase() + quest.atributo.slice(1))}</span><span class="badge ${done ? "badge-done" : "badge-pending"}">${done ? "Concluida" : "Pendente"}</span></div>${daily ? routineHtml(quest) : ""}</div><div class="quest-actions"><button class="btn btn-complete" type="button" data-action="complete" data-id="${quest.id}" ${done ? "disabled" : ""}>${done ? "Feita" : "Concluir"}</button><button class="btn btn-delete" type="button" data-action="delete" data-id="${quest.id}" aria-label="Remover quest">X</button></div></article>`;
}

async function loadQuests() {
  const quests = await db.getQuests(), daily = quests.filter((q) => q.tipo === "diaria"), active = quests.filter((q) => q.tipo !== "diaria" && q.status === "ativa");
  $("#daily-summary").textContent = daily.length ? `${daily.filter((q) => q.status === "concluida").length}/${daily.length} concluidas hoje · ciclo semanal inicia domingo` : "Nenhuma diaria cadastrada ainda.";
  $("#daily-list").innerHTML = daily.length ? daily.map(questHtml).join("") : `<p class="state-text">Cadastre uma quest como diaria para ela aparecer aqui.</p>`;
  $("#quest-list").innerHTML = active.length ? active.map(questHtml).join("") : `<p class="state-text">Nenhuma quest ativa.</p>`;
}

async function refresh() { try { await Promise.all([loadHero(), loadQuests()]); } catch (error) { toast(error.message || "Erro ao carregar dados."); } }
function syncWeeklyField() {
  const isDaily = $("#q-tipo").value === "diaria";
  const field = $("#q-semanal-field");
  if (!field) return;
  field.hidden = !isDaily;
  field.style.display = isDaily ? "grid" : "none";
}

async function addQuest(event) { event.preventDefault(); const name = $("#q-nome").value.trim(), button = event.submitter, type = $("#q-tipo").value, weeklyTarget = Number($("#q-semanal").value); if (!name) return toast("Digite o nome da quest."); busy(button, true); try { await db.addQuest(name, type, $("#q-atrib").value, weeklyTarget); $("#q-nome").value = ""; syncWeeklyField(); await loadQuests(); toast(type === "diaria" ? "Rotina diaria adicionada." : "Quest adicionada."); } catch (error) { toast(error.message); } finally { busy(button, false); } }
async function completeQuest(id, button) { busy(button, true); try { const result = await db.completeQuest(id); await refresh(); toast(result.hero.nivel > 1 ? `Quest concluida: +${result.hero.exp_atual} EXP atual` : "Quest concluida."); } catch (error) { toast(error.message); } finally { busy(button, false); } }
async function deleteQuest(id, button) { if (!confirm("Remover esta quest?")) return; busy(button, true); try { await db.deleteQuest(id); await loadQuests(); toast("Quest removida."); } catch (error) { toast(error.message); } finally { busy(button, false); } }
async function resetDailies(button) { busy(button, true); try { await db.resetDailies(); await loadQuests(); toast("Rotinas sincronizadas."); } catch (error) { toast(error.message); } finally { busy(button, false); } }
function formatDate(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date); }
async function loadHistory() { try { const rows = await db.getHistorico(); $("#hist-list").innerHTML = rows.length ? rows.slice(0, 50).map((item) => `<article class="history-item"><div class="history-title">${escapeHtml(item.acao)}</div><div class="history-meta"><span class="badge">+${item.exp_ganho} EXP</span><span class="badge">+${item.pontos} ${escapeHtml(item.atributo.toUpperCase())}</span><span class="badge">NV.${item.nivel_atual}</span><span class="badge">${escapeHtml(formatDate(item.created_at))}</span></div></article>`).join("") : `<p class="state-text">Nenhum registro ainda.</p>`; } catch (error) { toast(error.message); } }
async function exportData() { try { const data = await db.exportAll(), url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })), link = document.createElement("a"); link.href = url; link.download = `rpg-backup-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url); toast("Backup exportado."); } catch (error) { toast(error.message); } }
async function resetData() { if (!confirm("ATENCAO: Isso apagara seu heroi, quests e log. Deseja continuar?")) return; try { await db.resetAll(); await refresh(); toast("Dados resetados."); } catch (error) { toast(error.message); } }
function showTab(name) { document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === name)); document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.toggle("active", panel.id === `tab-${name}`)); }
async function login(event) { event.preventDefault(); const button = event.submitter, email = $("#auth-email").value.trim(), password = $("#auth-password").value; busy(button, true, button.dataset.mode === "signup" ? "Criando..." : "Entrando..."); try { if (button.dataset.mode === "signup") { const data = await db.signUp(email, password); toast(data.session ? "Conta criada." : "Conta criada. Confirme o email para entrar."); } else { await db.signIn(email, password); toast("Login realizado."); } } catch (error) { toast(error.message); } finally { busy(button, false); } }
async function boot(session) { setAppVisible(Boolean(session)); if (session) { $("#account-email").textContent = session.user.email; await refresh(); } }

async function saveCleanDate(event) {
  event.preventDefault();
  const dateVal = $("#clean-date-input").value;
  if (!dateVal) return toast("Selecione uma data.");
  const button = event.submitter || $("#clean-date-form button[type=submit]");
  busy(button, true);
  try {
    await db.setCleanDate(dateVal);
    await loadHero();
    toast("Data dos Dias Limpo salva.");
  } catch (error) {
    toast(error.message);
  } finally {
    busy(button, false);
  }
}

async function setCleanToday() {
  const today = new Date().toISOString().slice(0, 10);
  $("#clean-date-input").value = today;
  try {
    await db.setCleanDate(today);
    await loadHero();
    toast("Contador zerado para hoje.");
  } catch (error) {
    toast(error.message);
  }
}

function bind() {
  $("#auth-form").onsubmit = login;
  $("#btn-signup").onclick = (event) => { event.preventDefault(); login({ preventDefault() {}, submitter: event.currentTarget }); };
  $("#btn-logout").onclick = () => db.signOut();
  $("#quest-form").onsubmit = addQuest;
  $("#q-tipo").onchange = syncWeeklyField;
  syncWeeklyField();
  $(".tabs").onclick = (event) => { const tab = event.target.closest("[data-tab]"); if (tab) showTab(tab.dataset.tab); };
  document.body.onclick = (event) => { const button = event.target.closest("[data-action]"); if (!button) return; if (button.dataset.action === "complete") completeQuest(button.dataset.id, button); else deleteQuest(button.dataset.id, button); };
  $("#btn-export").onclick = exportData;
  $("#btn-reset-data").onclick = resetData;
  $("#clean-date-form").onsubmit = saveCleanDate;
  $("#btn-clean-today").onclick = setCleanToday;
  $("#btn-toggle-log").onclick = () => {
    const logSection = $("#config-log-section");
    const isHidden = logSection.style.display === "none";
    logSection.style.display = isHidden ? "block" : "none";
    $("#btn-toggle-log").textContent = isHidden ? "📜 Ocultar Log de batalhas" : "📜 Ver Log de batalhas";
    if (isHidden) loadHistory();
  };
}

async function init() { bind(); const session = await db.getSession(); await boot(session); db.onAuthChange((nextSession) => boot(nextSession)); }
init().catch((error) => toast(error.message));
