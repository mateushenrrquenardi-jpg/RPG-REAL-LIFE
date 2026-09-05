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
    const { data, error } = await client.from("quests").select("*").order("created_at", { ascending: true });
    throwOnError(error);
    return data;
  }

  async function getHistorico() {
    await requireUser();
    const { data, error } = await client.from("history").select("*").order("created_at", { ascending: false });
    throwOnError(error);
    return data;
  }

  async function addQuest(nome, tipo, atributo) {
    const { data, error } = await client
      .from("quests")
      .insert({ nome, tipo, atributo })
      .select("id")
      .single();
    throwOnError(error);
    return { success: true, id: data.id };
  }

  async function completeQuest(id) {
    const { data, error } = await client.rpc("complete_quest", { p_quest_id: id });
    throwOnError(error);
    return { success: true, hero: data };
  }

  async function deleteQuest(id) {
    const { error } = await client.from("quests").delete().eq("id", id);
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

  async function exportAll() {
    const [hero, quests, historico, cleanDate] = await Promise.all([
      getHero(),
      getQuests(),
      getHistorico(),
      getCleanDate().catch(() => null),
    ]);
    return { hero, quests, historico, clean_date: cleanDate, exportedAt: new Date().toISOString() };
  }

  function onAuthChange(handler) {
    return client.auth.onAuthStateChange((_event, session) => handler(session));
  }

  return {
    signUp, signIn, signOut, getSession, onAuthChange,
    getHero, getQuests, getHistorico, addQuest, completeQuest,
    deleteQuest, resetDailies, resetAll, exportAll,
    getCleanDate, setCleanDate,
  };
})();
