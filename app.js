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

let loadedQuests = [];
let pendingAvatarData = null;
let currentProgressQuest = null;

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

function toast(message) {
  const el = $("#toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 3500);
}

function busy(button, active, text = "Salvando...") {
  if (!button) return;
  if (active) {
    button.dataset.label = button.textContent;
    button.textContent = text;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.label || button.textContent;
    button.disabled = false;
  }
}

function setAppVisible(signedIn) {
  const authScreen = $("#auth-screen");
  const appScreen = $("#app-screen");
  if (authScreen) authScreen.hidden = signedIn;
  if (appScreen) appScreen.hidden = !signedIn;
}

async function loadHero() {
  const [hero, cleanDate, avatar] = await Promise.all([
    db.getHero(),
    db.getCleanDate().catch(() => null),
    db.getAvatar().catch(() => null),
  ]);
  const exp = Number(hero.exp_atual), need = Number(hero.exp_necessaria);
  const expFill = $("#exp-fill");
  const expVal = $("#exp-val");
  if (expFill) expFill.style.width = `${Math.max(0, Math.min(100, Math.round((exp / need) * 100)))}%`;
  if (expVal) expVal.textContent = `${exp} / ${need}`;

  const days = calcCleanDays(cleanDate);
  const cleanBadge = days !== null ? ` • ${days === 1 ? "1 DIA LIMPO" : `${days} DIAS LIMPO`}` : "";
  const heroClass = $("#hero-class");
  if (heroClass) heroClass.textContent = `// ${titleFor(hero.nivel).toUpperCase()} - NV.${hero.nivel}${cleanBadge}`;

  const gold = Number(hero.gold != null ? hero.gold : 0);
  const heroGold = $("#hero-gold");
  if (heroGold) heroGold.textContent = gold;
  const shopGold = $("#shop-gold");
  if (shopGold) shopGold.textContent = gold;

  const f = $("#a-forca"), m = $("#a-magia"), c = $("#a-carisma"), i = $("#a-intel");
  if (f) f.textContent = hero.forca;
  if (m) m.textContent = hero.magia;
  if (c) c.textContent = hero.carisma;
  if (i) i.textContent = hero.inteligencia;

  const defaultAvatar = "assets/profile.jpg?v=20260904-1";
  const currentAvatarSrc = avatar || defaultAvatar;
  const heroAvatar = $("#hero-avatar");
  if (heroAvatar) heroAvatar.src = currentAvatarSrc;
  const preview = $("#avatar-modal-preview");
  if (preview) preview.src = currentAvatarSrc;

  const cleanInput = $("#clean-date-input");
  if (cleanInput && cleanDate) cleanInput.value = cleanDate;
}

function goalUnitLabel(unit, count) {
  if (unit === "paginas") return count === 1 ? "página" : "páginas";
  if (unit === "aulas") return count === 1 ? "aula" : "aulas";
  if (unit === "horas") return count === 1 ? "hora" : "horas";
  if (unit === "porcentagem") return "%";
  if (unit === "reais") return "R$";
  return "";
}

function formatReais(value) {
  return Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function goalHtml(quest) {
  if (quest.tipo !== "principal" || !quest.goal_type || !quest.goal_total) return "";
  const total = Number(quest.goal_total);
  const current = Number(quest.goal_current || 0);
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
  const isComplete = current >= total;
  const unit = quest.goal_unit || (quest.goal_type === "livro" ? "paginas" : quest.goal_type === "compra" ? "reais" : "aulas");
  const targetName = escapeHtml(quest.goal_target_name || quest.nome);
  let progressText;
  if (unit === "porcentagem") {
    progressText = `${current}/${total}%`;
  } else if (unit === "reais") {
    progressText = `R$ ${formatReais(current)} / R$ ${formatReais(total)} · ${pct}%`;
  } else if (unit === "paginas") {
    progressText = `${current}/${total} PÁGINAS · ${pct}%`;
  } else if (unit === "aulas") {
    progressText = `${current}/${total} AULAS · ${pct}%`;
  } else if (unit === "horas") {
    progressText = `${current}/${total} HORAS · ${pct}%`;
  } else {
    progressText = `${current}/${total} · ${pct}%`;
  }
  return `<div class="goal-card ${isComplete ? "goal-complete" : ""}"><div class="goal-top"><span class="goal-rank">${targetName}</span><span>${escapeHtml(progressText)}</span></div><div class="goal-track" aria-label="Progresso da meta"><div class="goal-fill" style="width:${pct}%"></div></div></div>`;
}

function routineHtml(quest) {
  const routine = quest.routine;
  if (!routine) return "";
  const levelIdx = Math.min(Math.max(Number(quest.routine_level || 1), 1), ROUTINE_LEVELS.length) - 1;
  const level = ROUTINE_LEVELS[levelIdx];
  const days = Math.min(Number(routine.routine_days || 0), level.days);
  const pct = Math.min(100, Math.round((days / level.days) * 100));
  const fixed = routine.routine_fixed;
  const levelNum = String(quest.routine_level || 1).padStart(2, "0");
  const rankLabel = fixed ? "ROTINA FIXADA" : `Nivel ${levelNum} - ${level.name}`;
  return `<div class="routine-card ${fixed ? "routine-fixed" : ""}"><div class="routine-top"><span class="routine-rank">${rankLabel}</span><span>${days}/${level.days} DIAS · ${pct}%</span></div><div class="routine-track" aria-label="Progresso da rotina"><div class="routine-fill" style="width:${pct}%"></div></div></div>`;
}

function questHtml(quest) {
  const done = quest.status === "concluida", daily = quest.tipo === "diaria", principal = quest.tipo === "principal";
  const hasGoal = principal && Boolean(quest.goal_type) && Boolean(quest.goal_total);
  const label = principal ? "Principal" : daily ? "Diaria" : "Side";
  const style = principal ? "badge-main" : daily ? "badge-daily" : "";
  return `<article class="quest-item ${done ? "done" : ""}"><div class="quest-main"><div class="quest-title">${escapeHtml(quest.nome)}</div><div class="quest-meta"><span class="badge ${style}">${label}</span><span class="badge">${escapeHtml(quest.atributo[0].toUpperCase() + quest.atributo.slice(1))}</span><span class="badge ${done ? "badge-done" : "badge-pending"}">${done ? "Concluida" : "Pendente"}</span></div>${daily ? routineHtml(quest) : hasGoal ? goalHtml(quest) : ""}</div><div class="quest-actions">${hasGoal && !done ? `<button class="btn btn-progress" type="button" data-action="progress" data-id="${quest.id}">Progresso</button>` : ""}<button class="btn btn-complete" type="button" data-action="complete" data-id="${quest.id}" ${done ? "disabled" : ""}>${done ? "Feita" : "Concluir"}</button><button class="btn btn-edit" type="button" data-action="edit" data-id="${quest.id}" aria-label="Editar quest">✏️</button><button class="btn btn-delete" type="button" data-action="delete" data-id="${quest.id}" aria-label="Remover quest">X</button></div></article>`;
}

async function loadQuests() {
  // Reset automático das diárias quando o dia virar
  const todayKey = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  const lastSeenDay = localStorage.getItem("rpg_last_seen_day");
  if (lastSeenDay !== todayKey) {
    try {
      await db.resetDailies();
    } catch (_) { /* silencioso — não bloqueia o carregamento */ }
    localStorage.setItem("rpg_last_seen_day", todayKey);
  }

  const quests = await db.getQuests(), daily = quests.filter((q) => q.tipo === "diaria"), active = quests.filter((q) => q.tipo !== "diaria" && q.status === "ativa");
  loadedQuests = quests;
  const dailySummary = $("#daily-summary");
  if (dailySummary) dailySummary.textContent = daily.length ? `${daily.filter((q) => q.status === "concluida").length}/${daily.length} concluidas hoje · ciclo semanal inicia domingo` : "Nenhuma diaria cadastrada ainda.";
  const dailyList = $("#daily-list");
  if (dailyList) dailyList.innerHTML = daily.length ? daily.map(questHtml).join("") : `<p class="state-text">Cadastre uma quest como diaria para ela aparecer aqui.</p>`;
  const questList = $("#quest-list");
  if (questList) questList.innerHTML = active.length ? active.map(questHtml).join("") : `<p class="state-text">Nenhuma quest ativa.</p>`;
}

async function refresh() {
  try {
    await Promise.all([loadHero(), loadQuests()]);
  } catch (error) {
    toast(error.message || "Erro ao carregar dados.");
  }
}

function syncWeeklyField() {
  const isDaily = $("#q-tipo").value === "diaria";
  const field = $("#q-semanal-field");
  if (!field) return;
  field.hidden = !isDaily;
  field.style.display = isDaily ? "grid" : "none";
}

function syncGoalFields() {
  const isPrincipal = $("#q-tipo").value === "principal";
  const section = $("#q-goal-section");
  if (!section) return;
  section.hidden = !isPrincipal;
  section.style.display = isPrincipal ? "grid" : "none";
  if (!isPrincipal) return;

  const goalType = $("#q-goal-type").value;
  const livroFields = $("#q-goal-livro-fields");
  const cursoFields = $("#q-goal-curso-fields");
  const compraFields = $("#q-goal-compra-fields");

  livroFields.hidden = goalType !== "livro";
  livroFields.style.display = goalType === "livro" ? "grid" : "none";

  cursoFields.hidden = goalType !== "curso";
  cursoFields.style.display = goalType === "curso" ? "grid" : "none";

  compraFields.hidden = goalType !== "compra";
  compraFields.style.display = goalType === "compra" ? "grid" : "none";

  if (goalType === "curso") {
    const unit = $("#q-goal-curso-unit").value;
    const totalLabel = $("#q-goal-curso-total-label");
    const totalInput = $("#q-goal-curso-total");
    if (unit === "porcentagem") {
      totalLabel.textContent = "Total (%)";
      totalInput.value = "100";
      totalInput.readOnly = true;
    } else if (unit === "aulas") {
      totalLabel.textContent = "Total de aulas";
      totalInput.placeholder = "Ex: 12";
      totalInput.step = "1";
      totalInput.readOnly = false;
      if (totalInput.value === "100") totalInput.value = "";
    } else if (unit === "horas") {
      totalLabel.textContent = "Total de horas";
      totalInput.placeholder = "Ex: 20";
      totalInput.step = "any";
      totalInput.readOnly = false;
      if (totalInput.value === "100") totalInput.value = "";
    }
  }
}

function syncEditWeeklyField() {
  const isDaily = $("#edit-q-tipo").value === "diaria";
  const field = $("#edit-q-semanal-field");
  if (!field) return;
  field.hidden = !isDaily;
  field.style.display = isDaily ? "grid" : "none";
}

function syncEditGoalFields() {
  const isPrincipal = $("#edit-q-tipo").value === "principal";
  const section = $("#edit-q-goal-section");
  if (!section) return;
  section.hidden = !isPrincipal;
  section.style.display = isPrincipal ? "grid" : "none";
  if (!isPrincipal) return;

  const goalType = $("#edit-q-goal-type").value;
  const livroFields = $("#edit-q-goal-livro-fields");
  const cursoFields = $("#edit-q-goal-curso-fields");
  const compraFields = $("#edit-q-goal-compra-fields");

  livroFields.hidden = goalType !== "livro";
  livroFields.style.display = goalType === "livro" ? "grid" : "none";

  cursoFields.hidden = goalType !== "curso";
  cursoFields.style.display = goalType === "curso" ? "grid" : "none";

  compraFields.hidden = goalType !== "compra";
  compraFields.style.display = goalType === "compra" ? "grid" : "none";

  if (goalType === "curso") {
    const unit = $("#edit-q-goal-curso-unit").value;
    const totalLabel = $("#edit-q-goal-curso-total-label");
    const totalInput = $("#edit-q-goal-curso-total");
    if (unit === "porcentagem") {
      totalLabel.textContent = "Total (%)";
      totalInput.value = "100";
      totalInput.readOnly = true;
    } else if (unit === "aulas") {
      totalLabel.textContent = "Total de aulas";
      totalInput.placeholder = "Ex: 12";
      totalInput.step = "1";
      totalInput.readOnly = false;
    } else if (unit === "horas") {
      totalLabel.textContent = "Total de horas";
      totalInput.placeholder = "Ex: 20";
      totalInput.step = "any";
      totalInput.readOnly = false;
    }
  }
}

function getGoalFromForm(prefix) {
  const typeSelect = $(`#${prefix}-tipo`);
  if (!typeSelect || typeSelect.value !== "principal") return null;
  const goalType = $(`#${prefix}-goal-type`).value;
  if (!goalType) return null;

  if (goalType === "livro") {
    const targetName = $(`#${prefix}-goal-livro-nome`).value.trim();
    const totalVal = $(`#${prefix}-goal-livro-total`).value;
    const total = Number(totalVal);
    const currentVal = $(`#${prefix}-goal-livro-current`).value;
    const current = currentVal !== "" ? Number(currentVal) : 0;

    if (!targetName) throw new Error("Informe o nome do livro.");
    if (!totalVal || isNaN(total) || total <= 0) throw new Error("Informe um total de páginas válido (maior que 0).");
    if (isNaN(current) || current < 0) throw new Error("O progresso de páginas não pode ser negativo.");
    if (current > total) throw new Error("O progresso inicial não pode ser maior que o total de páginas.");

    return { type: "livro", targetName, unit: "paginas", total, current };
  }

  if (goalType === "curso") {
    const targetName = $(`#${prefix}-goal-curso-nome`).value.trim();
    const unit = $(`#${prefix}-goal-curso-unit`).value || "aulas";
    const totalVal = $(`#${prefix}-goal-curso-total`).value;
    const total = unit === "porcentagem" ? 100 : Number(totalVal);
    const currentVal = $(`#${prefix}-goal-curso-current`).value;
    const current = currentVal !== "" ? Number(currentVal) : 0;

    if (!targetName) throw new Error("Informe o nome do curso.");
    if (unit !== "porcentagem" && (!totalVal || isNaN(total) || total <= 0)) {
      throw new Error("Informe um total válido maior que 0 para o curso.");
    }
    if (isNaN(current) || current < 0) throw new Error("O progresso não pode ser negativo.");
    if (current > total) throw new Error("O progresso inicial não pode ser maior que o total do curso.");

    return { type: "curso", targetName, unit, total, current };
  }

  if (goalType === "compra") {
    const targetName = $(`#${prefix}-goal-compra-nome`).value.trim();
    const totalVal = $(`#${prefix}-goal-compra-total`).value;
    const total = Number(totalVal);
    const currentVal = $(`#${prefix}-goal-compra-current`).value;
    const current = currentVal !== "" ? Number(currentVal) : 0;

    if (!targetName) throw new Error("Informe o nome do item que deseja comprar.");
    if (!totalVal || isNaN(total) || total <= 0) throw new Error("Informe o preço total do item (maior que 0).");
    if (isNaN(current) || current < 0) throw new Error("O valor já guardado não pode ser negativo.");
    if (current > total) throw new Error("O valor já guardado não pode ser maior que o preço total.");

    return { type: "compra", targetName, unit: "reais", total, current };
  }

  return null;
}

function openEditModal(id) {
  const quest = loadedQuests.find((q) => String(q.id) === String(id));
  if (!quest) return toast("Quest nao encontrada.");
  $("#edit-q-id").value = quest.id;
  $("#edit-q-nome").value = quest.nome;
  $("#edit-q-tipo").value = quest.tipo;
  $("#edit-q-atrib").value = quest.atributo;
  $("#edit-q-semanal").value = String(quest.weekly_target || 7);

  const goalType = quest.goal_type || "";
  $("#edit-q-goal-type").value = goalType;
  if (goalType === "livro") {
    $("#edit-q-goal-livro-nome").value = quest.goal_target_name || quest.nome || "";
    $("#edit-q-goal-livro-total").value = quest.goal_total || "";
    $("#edit-q-goal-livro-current").value = quest.goal_current != null ? quest.goal_current : 0;
    $("#edit-q-goal-curso-nome").value = "";
    $("#edit-q-goal-curso-unit").value = "aulas";
    $("#edit-q-goal-curso-total").value = "";
    $("#edit-q-goal-curso-current").value = "0";
    $("#edit-q-goal-compra-nome").value = "";
    $("#edit-q-goal-compra-total").value = "";
    $("#edit-q-goal-compra-current").value = "0";
  } else if (goalType === "curso") {
    $("#edit-q-goal-curso-nome").value = quest.goal_target_name || quest.nome || "";
    $("#edit-q-goal-curso-unit").value = quest.goal_unit || "aulas";
    $("#edit-q-goal-curso-total").value = quest.goal_unit === "porcentagem" ? 100 : (quest.goal_total || "");
    $("#edit-q-goal-curso-current").value = quest.goal_current != null ? quest.goal_current : 0;
    $("#edit-q-goal-livro-nome").value = "";
    $("#edit-q-goal-livro-total").value = "";
    $("#edit-q-goal-livro-current").value = "0";
    $("#edit-q-goal-compra-nome").value = "";
    $("#edit-q-goal-compra-total").value = "";
    $("#edit-q-goal-compra-current").value = "0";
  } else if (goalType === "compra") {
    $("#edit-q-goal-compra-nome").value = quest.goal_target_name || quest.nome || "";
    $("#edit-q-goal-compra-total").value = quest.goal_total || "";
    $("#edit-q-goal-compra-current").value = quest.goal_current != null ? quest.goal_current : 0;
    $("#edit-q-goal-livro-nome").value = "";
    $("#edit-q-goal-livro-total").value = "";
    $("#edit-q-goal-livro-current").value = "0";
    $("#edit-q-goal-curso-nome").value = "";
    $("#edit-q-goal-curso-unit").value = "aulas";
    $("#edit-q-goal-curso-total").value = "";
    $("#edit-q-goal-curso-current").value = "0";
  } else {
    $("#edit-q-goal-livro-nome").value = "";
    $("#edit-q-goal-livro-total").value = "";
    $("#edit-q-goal-livro-current").value = "0";
    $("#edit-q-goal-curso-nome").value = "";
    $("#edit-q-goal-curso-unit").value = "aulas";
    $("#edit-q-goal-curso-total").value = "";
    $("#edit-q-goal-curso-current").value = "0";
    $("#edit-q-goal-compra-nome").value = "";
    $("#edit-q-goal-compra-total").value = "";
    $("#edit-q-goal-compra-current").value = "0";
  }

  syncEditWeeklyField();
  syncEditGoalFields();
  const modal = $("#edit-quest-modal");
  if (modal.showModal) modal.showModal();
  else modal.setAttribute("open", "");
}

function closeEditModal() {
  const modal = $("#edit-quest-modal");
  if (modal.close) modal.close();
  else modal.removeAttribute("open");
}

async function saveQuestEdit(event) {
  event.preventDefault();
  const id = $("#edit-q-id").value;
  const name = $("#edit-q-nome").value.trim();
  const type = $("#edit-q-tipo").value;
  const atrib = $("#edit-q-atrib").value;
  const weeklyTarget = Number($("#edit-q-semanal").value);
  const button = event.submitter || $("#edit-quest-form button[type=submit]");
  if (!name) return toast("Digite o nome da quest.");

  let goal = null;
  try {
    goal = getGoalFromForm("edit-q");
  } catch (err) {
    return toast(err.message);
  }

  busy(button, true, "Salvando...");
  try {
    await db.updateQuest(id, { nome: name, tipo: type, atributo: atrib, weeklyTarget, goal });
    closeEditModal();
    await loadQuests();
    toast("Quest atualizada.");
  } catch (error) {
    toast(error.message || "Erro ao atualizar quest.");
  } finally {
    busy(button, false);
  }
}

function openProgressModal(id) {
  const quest = loadedQuests.find((q) => String(q.id) === String(id));
  if (!quest || quest.tipo !== "principal" || !quest.goal_type) return toast("Meta não encontrada.");
  currentProgressQuest = quest;
  $("#prog-q-id").value = quest.id;

  const total = Number(quest.goal_total || 0);
  const current = Number(quest.goal_current || 0);
  const unit = quest.goal_unit || (quest.goal_type === "livro" ? "paginas" : quest.goal_type === "compra" ? "reais" : "aulas");
  const targetName = escapeHtml(quest.goal_target_name || quest.nome);
  let currentText;
  if (unit === "porcentagem") {
    currentText = `${current} / ${total}%`;
  } else if (unit === "reais") {
    currentText = `R$ ${formatReais(current)} / R$ ${formatReais(total)}`;
  } else {
    const unitLabel = goalUnitLabel(unit, total);
    currentText = `${current} / ${total} ${unitLabel}`;
  }
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;

  $("#prog-quest-summary").innerHTML = `
    <div style="margin-bottom: 4px;">
      <span class="system-label" style="font-size: 11px;">Missão Principal</span>
      <div style="font-size: 15px; font-weight: 700; color: var(--text);">${escapeHtml(quest.nome)}</div>
    </div>
    <div>Meta: <strong>${targetName}</strong></div>
    <div style="margin-top: 4px; color: var(--muted); font-size: 12px;">Progresso atual: <strong style="color: var(--cyan);">${escapeHtml(currentText)}</strong> (${pct}%)</div>
  `;

  const input = $("#prog-input-value");
  const label = $("#prog-input-label");
  const hint = $("#prog-hint");

  if (quest.goal_type === "livro") {
    label.textContent = "Quantas páginas você leu agora? (será somado)";
    const remaining = Math.max(0, total - current);
    hint.textContent = remaining > 0 ? `Máximo para atingir a meta: +${remaining} páginas.` : "Meta já atingida!";
    input.min = "0";
    input.max = String(remaining);
    input.step = "1";
    input.value = "";
    input.placeholder = remaining > 0 ? `Ex: ${Math.min(10, remaining)}` : "0";
  } else if (quest.goal_type === "compra") {
    label.textContent = "Quanto você guardou agora? (R$) — será somado ao total";
    const remaining = Math.max(0, Number((total - current).toFixed(2)));
    hint.textContent = remaining > 0 ? `Faltam R$ ${formatReais(remaining)} para atingir a meta.` : "Meta já atingida!";
    input.min = "0";
    input.max = String(remaining);
    input.step = "0.01";
    input.value = "";
    input.placeholder = remaining > 0 ? `Ex: ${Math.min(100, remaining).toFixed(2)}` : "0";
  } else if (quest.goal_type === "curso") {
    if (unit === "aulas") {
      label.textContent = "Quantas aulas concluídas agora? (será somado)";
      const remaining = Math.max(0, total - current);
      hint.textContent = remaining > 0 ? `Máximo para atingir a meta: +${remaining} aulas.` : "Meta já atingida!";
      input.min = "0";
      input.max = String(remaining);
      input.step = "1";
      input.value = "";
      input.placeholder = remaining > 0 ? "Ex: 1" : "0";
    } else if (unit === "horas") {
      label.textContent = "Quantas horas estudadas agora? (será somado)";
      const remaining = Math.max(0, Number((total - current).toFixed(2)));
      hint.textContent = remaining > 0 ? `Máximo para atingir a meta: +${remaining} horas.` : "Meta já atingida!";
      input.min = "0";
      input.max = String(remaining);
      input.step = "any";
      input.value = "";
      input.placeholder = remaining > 0 ? "Ex: 1.5" : "0";
    } else if (unit === "porcentagem") {
      label.textContent = "Novo percentual concluído do curso (%)";
      hint.textContent = `Informe a porcentagem atual do curso (Atual: ${current}% / Meta: 100%).`;
      input.min = "0";
      input.max = "100";
      input.step = "any";
      input.value = current || "";
      input.placeholder = `Ex: ${Math.min(100, current + 10)}`;
    }
  }

  updateProgressPreview();
  const modal = $("#progress-quest-modal");
  if (modal.showModal) modal.showModal();
  else modal.setAttribute("open", "");
}

function updateProgressPreview() {
  if (!currentProgressQuest) return;
  const quest = currentProgressQuest;
  const total = Number(quest.goal_total || 0);
  const current = Number(quest.goal_current || 0);
  const unit = quest.goal_unit || (quest.goal_type === "livro" ? "paginas" : quest.goal_type === "compra" ? "reais" : "aulas");
  const rawVal = $("#prog-input-value").value;
  const inputNum = rawVal !== "" ? Number(rawVal) : 0;

  let newCurrent = current;
  if (unit === "porcentagem") {
    newCurrent = rawVal !== "" ? inputNum : current;
  } else {
    newCurrent = current + (rawVal !== "" ? inputNum : 0);
  }

  newCurrent = Math.max(0, Math.min(total, newCurrent));
  const pct = total > 0 ? Math.min(100, Math.round((newCurrent / total) * 100)) : 0;
  const isComplete = newCurrent >= total;
  let text;
  if (unit === "porcentagem") {
    text = `${newCurrent}/${total}%`;
  } else if (unit === "reais") {
    text = `R$ ${formatReais(newCurrent)} / R$ ${formatReais(total)} · ${pct}%`;
  } else if (unit === "paginas") {
    text = `${newCurrent}/${total} PÁGINAS · ${pct}%`;
  } else if (unit === "aulas") {
    text = `${newCurrent}/${total} AULAS · ${pct}%`;
  } else if (unit === "horas") {
    text = `${newCurrent}/${total} HORAS · ${pct}%`;
  } else {
    text = `${newCurrent}/${total} · ${pct}%`;
  }

  const preview = $("#prog-preview-card");
  preview.innerHTML = `
    <div class="goal-card ${isComplete ? "goal-complete" : ""}">
      <div class="goal-top">
        <span class="goal-rank">Prévia: ${escapeHtml(quest.goal_target_name || quest.nome)}</span>
        <span>${escapeHtml(text)}</span>
      </div>
      <div class="goal-track" aria-label="Progresso da meta"><div class="goal-fill" style="width:${pct}%"></div></div>
    </div>
  `;
}

function closeProgressModal() {
  currentProgressQuest = null;
  const modal = $("#progress-quest-modal");
  if (modal.close) modal.close();
  else modal.removeAttribute("open");
}

async function saveQuestProgress(event) {
  event.preventDefault();
  if (!currentProgressQuest) return;
  const quest = currentProgressQuest;
  const total = Number(quest.goal_total || 0);
  const current = Number(quest.goal_current || 0);
  const unit = quest.goal_unit || (quest.goal_type === "livro" ? "paginas" : quest.goal_type === "compra" ? "reais" : "aulas");
  const rawVal = $("#prog-input-value").value;
  const button = event.submitter || $("#progress-quest-form button[type=submit]");

  if (rawVal === "") return toast("Informe um valor para atualizar.");
  const inputVal = Number(rawVal);
  if (isNaN(inputVal) || inputVal < 0) return toast("Informe um valor positivo válido.");

  let newCurrent = current;
  if (unit === "porcentagem") {
    newCurrent = inputVal;
  } else {
    newCurrent = current + inputVal;
  }

  if (newCurrent > total) {
    return toast(`O progresso não pode ultrapassar o total de ${total}.`);
  }

  busy(button, true, "Salvando...");
  try {
    await db.updateQuestProgress(quest.id, newCurrent);
    closeProgressModal();
    await loadQuests();
    if (newCurrent >= total) {
      toast("Parabéns! Meta concluída com sucesso! 🏆");
    } else {
      toast("Progresso atualizado com sucesso!");
    }
  } catch (error) {
    toast(error.message || "Erro ao salvar progresso.");
  } finally {
    busy(button, false);
  }
}

function processImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      return reject(new Error("Por favor, selecione um arquivo de imagem valido."));
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxDim = 320;
        let w = img.width, h = img.height;
        if (w > h) {
          if (w > maxDim) { h = Math.round((h * maxDim) / w); w = maxDim; }
        } else {
          if (h > maxDim) { w = Math.round((w * maxDim) / h); h = maxDim; }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error("Erro ao processar imagem."));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("Erro ao ler arquivo."));
    reader.readAsDataURL(file);
  });
}

function openAvatarModal() {
  pendingAvatarData = null;
  const currentSrc = $("#hero-avatar") ? $("#hero-avatar").src : "assets/profile.jpg?v=20260904-1";
  $("#avatar-modal-preview").src = currentSrc;
  $("#avatar-url-input").value = "";
  $("#avatar-file-input").value = "";
  const modal = $("#avatar-modal");
  if (modal.showModal) modal.showModal();
  else modal.setAttribute("open", "");
}

function closeAvatarModal() {
  const modal = $("#avatar-modal");
  if (modal.close) modal.close();
  else modal.removeAttribute("open");
}

async function handleAvatarFileSelect(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  try {
    const dataUrl = await processImageFile(file);
    pendingAvatarData = dataUrl;
    $("#avatar-modal-preview").src = dataUrl;
    $("#avatar-url-input").value = "";
    toast("Imagem carregada. Clique em Salvar Foto.");
  } catch (error) {
    toast(error.message);
  }
}

async function saveAvatar() {
  const urlVal = $("#avatar-url-input").value.trim();
  const finalAvatar = urlVal || pendingAvatarData;
  if (!finalAvatar) return toast("Escolha uma imagem ou informe um link.");
  const button = $("#btn-save-avatar");
  busy(button, true, "Salvando...");
  try {
    await db.setAvatar(finalAvatar);
    await loadHero();
    closeAvatarModal();
    toast("Foto de perfil atualizada!");
  } catch (error) {
    toast(error.message || "Erro ao salvar foto.");
  } finally {
    busy(button, false);
  }
}

async function resetAvatarDefault() {
  const button = $("#btn-reset-avatar-default");
  busy(button, true, "Restaurando...");
  try {
    await db.setAvatar(null);
    await loadHero();
    closeAvatarModal();
    toast("Foto padrão restaurada!");
  } catch (error) {
    toast(error.message || "Erro ao restaurar foto padrão.");
  } finally {
    busy(button, false);
  }
}

async function addQuest(event) {
  event.preventDefault();
  const name = $("#q-nome").value.trim();
  const button = event.submitter || $("#quest-form button[type=submit]");
  const type = $("#q-tipo").value;
  const weeklyTarget = Number($("#q-semanal").value);
  if (!name) return toast("Digite o nome da quest.");

  let goal = null;
  try {
    goal = getGoalFromForm("q");
  } catch (err) {
    return toast(err.message);
  }

  busy(button, true);
  try {
    await db.addQuest(name, type, $("#q-atrib").value, weeklyTarget, goal);
    $("#q-nome").value = "";
    $("#q-goal-type").value = "";
    $("#q-goal-livro-nome").value = "";
    $("#q-goal-livro-total").value = "";
    $("#q-goal-livro-current").value = "0";
    $("#q-goal-curso-nome").value = "";
    $("#q-goal-curso-unit").value = "aulas";
    $("#q-goal-curso-total").value = "";
    $("#q-goal-curso-current").value = "0";
    $("#q-goal-compra-nome").value = "";
    $("#q-goal-compra-total").value = "";
    $("#q-goal-compra-current").value = "0";
    syncWeeklyField();
    syncGoalFields();
    await loadQuests();
    toast(type === "diaria" ? "Rotina diaria adicionada." : "Quest adicionada.");
  } catch (error) {
    toast(error.message);
  } finally {
    busy(button, false);
  }
}

async function completeQuest(id, button) {
  busy(button, true);
  try {
    const quest = loadedQuests.find((q) => String(q.id) === String(id));
    const isDaily = quest && quest.tipo === "diaria";
    const isSide = quest && quest.tipo === "side";
    const result = await db.completeQuest(id);
    await refresh();
    const goldEarned = isDaily ? 7 : isSide ? 3 : 0;
    const goldBonus = goldEarned > 0 ? ` • +${goldEarned} GOLD` : "";
    toast(result.hero.nivel > 1 ? `Quest concluida: +${result.hero.exp_atual} EXP atual${goldBonus}` : `Quest concluida.${goldBonus}`);
  } catch (error) {
    toast(error.message);
  } finally {
    busy(button, false);
  }
}

async function deleteQuest(id, button) {
  if (!confirm("Remover esta quest?")) return;
  busy(button, true);
  try {
    await db.deleteQuest(id);
    await loadQuests();
    toast("Quest removida.");
  } catch (error) {
    toast(error.message);
  } finally {
    busy(button, false);
  }
}

async function resetDailies(button) {
  busy(button, true);
  try {
    await db.resetDailies();
    await loadQuests();
    toast("Rotinas sincronizadas.");
  } catch (error) {
    toast(error.message);
  } finally {
    busy(button, false);
  }
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
}

async function loadHistory() {
  try {
    const rows = await db.getHistorico();
    $("#hist-list").innerHTML = rows.length
      ? rows
          .slice(0, 50)
          .map(
            (item) =>
              `<article class="history-item"><div class="history-title">${escapeHtml(
                item.acao
              )}</div><div class="history-meta"><span class="badge">+${item.exp_ganho} EXP</span><span class="badge">+${
                item.pontos
              } ${escapeHtml(item.atributo.toUpperCase())}</span><span class="badge">NV.${
                item.nivel_atual
              }</span><span class="badge">${escapeHtml(formatDate(item.created_at))}</span></div></article>`
          )
          .join("")
      : `<p class="state-text">Nenhum registro ainda.</p>`;
  } catch (error) {
    toast(error.message);
  }
}

async function exportData() {
  try {
    const data = await db.exportAll(),
      url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })),
      link = document.createElement("a");
    link.href = url;
    link.download = `rpg-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast("Backup exportado.");
  } catch (error) {
    toast(error.message);
  }
}

async function resetData() {
  if (!confirm("ATENCAO: Isso apagara seu heroi, quests e log. Deseja continuar?")) return;
  try {
    await db.resetAll();
    await refresh();
    toast("Dados resetados.");
  } catch (error) {
    toast(error.message);
  }
}

function showTab(name) {
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === name));
  document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.toggle("active", panel.id === `tab-${name}`));
}

async function login(event) {
  event.preventDefault();
  const button = event.submitter || $("#auth-form button[type=submit]");
  const email = $("#auth-email").value.trim();
  const password = $("#auth-password").value;
  busy(button, true, button.dataset?.mode === "signup" ? "Criando..." : "Entrando...");
  try {
    if (button.dataset?.mode === "signup") {
      const data = await db.signUp(email, password);
      toast(data.session ? "Conta criada." : "Conta criada. Confirme o email para entrar.");
      if (data.session) await boot(data.session);
    } else {
      const data = await db.signIn(email, password);
      toast("Login realizado.");
      if (data.session) await boot(data.session);
    }
  } catch (error) {
    toast(error.message);
  } finally {
    busy(button, false);
  }
}

async function boot(session) {
  setAppVisible(Boolean(session));
  if (session) {
    const accEmail = $("#account-email");
    if (accEmail) accEmail.textContent = session.user.email;
    await refresh();
  }
}

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
  $("#btn-signup").onclick = (event) => {
    event.preventDefault();
    login({ preventDefault() {}, submitter: event.currentTarget });
  };
  $("#btn-logout").onclick = async () => {
    await db.signOut();
    setAppVisible(false);
  };
  $("#quest-form").onsubmit = addQuest;
  $("#q-tipo").onchange = () => {
    syncWeeklyField();
    syncGoalFields();
  };
  $("#q-goal-type").onchange = syncGoalFields;
  $("#q-goal-curso-unit").onchange = syncGoalFields;
  syncWeeklyField();
  syncGoalFields();

  $(".tabs").onclick = (event) => {
    const tab = event.target.closest("[data-tab]");
    if (tab) showTab(tab.dataset.tab);
  };

  document.body.onclick = (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    if (button.dataset.action === "complete") completeQuest(button.dataset.id, button);
    else if (button.dataset.action === "edit") openEditModal(button.dataset.id);
    else if (button.dataset.action === "delete") deleteQuest(button.dataset.id, button);
    else if (button.dataset.action === "progress") openProgressModal(button.dataset.id);
  };

  $("#edit-q-tipo").onchange = () => {
    syncEditWeeklyField();
    syncEditGoalFields();
  };
  $("#edit-q-goal-type").onchange = syncEditGoalFields;
  $("#edit-q-goal-curso-unit").onchange = syncEditGoalFields;
  $("#edit-quest-form").onsubmit = saveQuestEdit;
  $("#btn-close-edit-modal").onclick = closeEditModal;
  $("#btn-cancel-edit").onclick = closeEditModal;
  $("#edit-quest-modal").onclick = (event) => {
    if (event.target === $("#edit-quest-modal")) closeEditModal();
  };

  $("#progress-quest-form").onsubmit = saveQuestProgress;
  $("#prog-input-value").oninput = updateProgressPreview;
  $("#btn-close-progress-modal").onclick = closeProgressModal;
  $("#btn-cancel-progress").onclick = closeProgressModal;
  $("#progress-quest-modal").onclick = (event) => {
    if (event.target === $("#progress-quest-modal")) closeProgressModal();
  };

  $("#btn-change-avatar").onclick = openAvatarModal;
  $("#btn-close-avatar-modal").onclick = closeAvatarModal;
  $("#btn-select-avatar-file").onclick = () => $("#avatar-file-input").click();
  $("#avatar-file-input").onchange = handleAvatarFileSelect;
  $("#avatar-url-input").oninput = () => {
    const url = $("#avatar-url-input").value.trim();
    if (url) {
      pendingAvatarData = null;
      $("#avatar-modal-preview").src = url;
    }
  };
  $("#btn-save-avatar").onclick = saveAvatar;
  $("#btn-reset-avatar-default").onclick = resetAvatarDefault;
  $("#avatar-modal").onclick = (event) => {
    if (event.target === $("#avatar-modal")) closeAvatarModal();
  };

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

async function init() {
  bind();
  const session = await db.getSession();
  await boot(session);
  db.onAuthChange((nextSession) => boot(nextSession));
}

init().catch((error) => toast(error.message));
