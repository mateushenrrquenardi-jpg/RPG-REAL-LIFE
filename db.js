/* global supabase */

/**
 * Camada de dados do Supabase.
 * A chave abaixo e publica por projeto: a protecao dos dados e feita pelas
 * politicas RLS configuradas no PostgreSQL, nunca por uma chave secreta no site.
 */
const db = (() => {
  const PROJECT_URL = "https://eddapoexxzlxicqkvxts.supabase.co";
  const PUBLISHABLE_KEY = "sb_publishable_6LMr2SeR4m0zyTGwtpB2fw_ZEwvHu4Q";
  const client = supabase.createClient(PROJECT_URL, PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });

  function requireUser() {
    return client.auth.getUser().then(({ data, error }) => {
      if (error || !data.user) throw new Error("Faca login para acessar seu RPG.");
      return data.user;
    });
  }

  function throwOnError(error) {
    if (error) throw new Error(error.message);
  }

  function questRpcPayload(id, nome, tipo, atributo, weeklyTarget, goal) {
    return {
      p_quest_id: id,
      p_nome: nome,
      p_tipo: tipo,
      p_atributo: atributo,
      p_weekly_target: Number(weeklyTarget || 7),
      p_goal_type: goal?.type || null,
      p_goal_target_name: goal?.targetName || null,
      p_goal_unit: goal?.unit || null,
      p_goal_total: goal?.total != null ? Number(goal.total) : null,
      p_goal_current: goal?.current != null ? Number(goal.current) : 0,
    };
  }

  async function signUp(email, password) {
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.href.split("#")[0] },
    });
    throwOnError(error);
    return data;
  }

  async function signIn(email, password) {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    throwOnError(error);
    return data;
  }

  async function signOut() {
    const { error } = await client.auth.signOut();
    throwOnError(error);
  }

  async function getSession() {
    const { data, error } = await client.auth.getSession();
    throwOnError(error);
    return data.session;
  }

  async function getHero() {
    await requireUser();
    const { data, error } = await client.from("profiles").select("*").single();
    throwOnError(error);
    return data;
  }

  async function getQuests() {
    await requireUser();
    const [{ data, error }, { data: routineState, error: stateError }] = await Promise.all([
      client.from("quests").select("*").order("created_at", { ascending: true }),
      client.rpc("get_daily_routine_state"),
    ]);
    throwOnError(error);
    throwOnError(stateError);
    const stateByQuest = new Map((routineState || []).map((state) => [state.quest_id, state]));
    return data.map((quest) => ({ ...quest, routine: stateByQuest.get(quest.id) || null }));
  }

  async function getHistorico(limit = null) {
    await requireUser();
    let query = client.from("history").select("*").order("created_at", { ascending: false });
    if (limit != null) query = query.limit(Math.max(1, Math.min(Number(limit), 250)));
    const { data, error } = await query;
    throwOnError(error);
    return data;
  }

  async function getGoldHistory(limit = null) {
    await requireUser();
    let query = client.from("gold_transactions").select("*").order("created_at", { ascending: false });
    if (limit != null) query = query.limit(Math.max(1, Math.min(Number(limit), 250)));
    const { data, error } = await query;
    throwOnError(error);
    return data || [];
  }

  async function getCustomRewards() {
    await requireUser();
    const { data, error } = await client.from("custom_rewards").select("*").order("created_at", { ascending: false });
    throwOnError(error);
    return data || [];
  }

  async function getHeroOverview() {
    const { data, error } = await client.rpc("get_hero_overview");
    throwOnError(error);
    return data;
  }

  async function addCustomReward({ name, description, realValue, goldPrice, rarity }) {
    const { data, error } = await client.rpc("save_custom_reward", {
      p_name: name, p_description: description || null, p_real_value: realValue, p_gold_price: goldPrice, p_rarity: rarity,
    });
    throwOnError(error);
    return data;
  }

  async function deleteCustomReward(id) {
    const { error } = await client.rpc("delete_own_custom_reward", { p_reward_id: id });
    throwOnError(error);
  }

  async function redeemReward({ name, category, goldPrice, description, realValue = null, rarity, customRewardId = null }) {
    const { data, error } = await client.rpc("redeem_gold_reward", { p_reward_name: name, p_category: category, p_gold_price: Number(goldPrice), p_description: description || null, p_real_value: realValue == null ? null : Number(realValue), p_rarity: rarity, p_custom_reward_id: customRewardId });
    throwOnError(error);
    return data;
  }

  async function addQuest(nome, tipo, atributo, weeklyTarget = 7, goal = null) {
    const { data, error } = await client.rpc("save_quest", questRpcPayload(null, nome, tipo, atributo, weeklyTarget, goal));
    throwOnError(error);
    return { success: true, id: data.id };
  }

  async function updateQuest(id, { nome, tipo, atributo, weeklyTarget = 7, goal = null }) {
    const { data, error } = await client.rpc("save_quest", questRpcPayload(id, nome, tipo, atributo, weeklyTarget, goal));
    throwOnError(error);
    return { success: true, quest: data };
  }

  async function updateQuestProgress(id, currentProgress) {
    const { data, error } = await client.rpc("update_main_quest_progress", {
      p_quest_id: id,
      p_goal_current: Number(currentProgress),
    });
    throwOnError(error);
    return { success: true, result: data };
  }

  async function completeQuest(id) {
    const { data, error } = await client.rpc("complete_quest", { p_quest_id: id });
    throwOnError(error);
    return { success: true, hero: data };
  }

  async function deleteQuest(id) {
    const { error } = await client.rpc("delete_own_quest", { p_quest_id: id });
    throwOnError(error);
    return { success: true };
  }

  async function resetDailies() {
    const { data, error } = await client.rpc("reset_daily_quests");
    throwOnError(error);
    return { success: true, resetCount: data || 0 };
  }

  async function resetAll() {
    const { error } = await client.rpc("reset_rpg");
    throwOnError(error);
    return { success: true };
  }

  async function getCleanDate() {
    const user = await requireUser();
    const metaDate = user.user_metadata?.clean_date;
    if (metaDate) return metaDate;
    return localStorage.getItem(`rpg_clean_date_${user.id}`) || null;
  }

  async function setCleanDate(dateStr) {
    const user = await requireUser();
    if (dateStr) {
      localStorage.setItem(`rpg_clean_date_${user.id}`, dateStr);
    } else {
      localStorage.removeItem(`rpg_clean_date_${user.id}`);
    }
    const { error } = await client.auth.updateUser({
      data: { clean_date: dateStr || null },
    });
    throwOnError(error);
    return dateStr;
  }

  async function getAvatar() {
    const user = await requireUser();
    const metaAvatar = user.user_metadata?.custom_avatar;
    if (metaAvatar) return metaAvatar;
    return localStorage.getItem(`rpg_avatar_${user.id}`) || null;
  }

  async function setAvatar(avatarUrlOrBase64) {
    const user = await requireUser();
    if (avatarUrlOrBase64) {
      localStorage.setItem(`rpg_avatar_${user.id}`, avatarUrlOrBase64);
    } else {
      localStorage.removeItem(`rpg_avatar_${user.id}`);
    }
    const { error } = await client.auth.updateUser({
      data: { custom_avatar: avatarUrlOrBase64 || null },
    });
    throwOnError(error);
    return avatarUrlOrBase64;
  }

  async function exportAll() {
    const [hero, quests, historico, goldHistory, customRewards, cleanDate, avatar] = await Promise.all([
      getHero(),
      getQuests(),
      getHistorico(),
      getGoldHistory(),
      getCustomRewards(),
      getCleanDate().catch(() => null),
      getAvatar().catch(() => null),
    ]);
    return { hero, quests, historico, gold_history: goldHistory, custom_rewards: customRewards, clean_date: cleanDate, avatar, exportedAt: new Date().toISOString() };
  }

  function onAuthChange(handler) {
    return client.auth.onAuthStateChange((_event, session) => handler(session));
  }

  return {
    signUp, signIn, signOut, getSession, onAuthChange,
    getHero, getQuests, getHistorico, getGoldHistory, getCustomRewards, getHeroOverview, addCustomReward, deleteCustomReward, redeemReward, addQuest, updateQuest, updateQuestProgress, completeQuest,
    deleteQuest, resetDailies, resetAll, exportAll,
    getCleanDate, setCleanDate, getAvatar, setAvatar,
  };
})();
