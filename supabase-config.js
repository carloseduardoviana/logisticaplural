window.logiFlowSync = (() => {
  const SUPABASE_URL = "https://eynhnuoiqumyjktwbvhw.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_evbgYU7X1rdKjC3dsiCm5w_hc3mRfzt";
  const TABLE = "shared_state";
  const ROW_ID = "logiflow-main";
  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { storageKey: "pluralmed-auth-v2", persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
  let saveTimer = null;
  const loginEmail = (loginCode) => `${String(loginCode).trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "")}@logisticaplural.com`;

  async function load() {
    const { data, error } = await client
      .from(TABLE)
      .select("data")
      .eq("id", ROW_ID)
      .maybeSingle();
    if (error) throw error;
    return data?.data || null;
  }

  function save(state) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      const { error } = await client
        .from(TABLE)
        .upsert({ id: ROW_ID, data: state, updated_at: new Date().toISOString() }, { onConflict: "id" });
      if (error) {
        console.error("Não foi possível salvar os dados compartilhados:", error.message);
        return false;
      }
      return true;
    }, 250);
  }

  function subscribe(onChange) {
    return client
      .channel("logiflow-live")
      .on("postgres_changes", { event: "*", schema: "public", table: TABLE, filter: `id=eq.${ROW_ID}` }, (payload) => {
        if (payload.new?.data) onChange(payload.new.data);
      })
      .subscribe();
  }

  async function login(loginCode, password) {
    const email = loginEmail(loginCode);
    const { data: resolvedEmail } = await client.rpc("get_login_email", {
      p_login_code: loginCode.trim()
    });
    const candidates = [
      resolvedEmail,
      email,
      `${email.slice(0, email.lastIndexOf("@"))}@logisticaplural.app`
    ].filter(Boolean);

    let lastResult = null;
    for (const candidate of [...new Set(candidates.map((item) => String(item).trim().toLowerCase()))]) {
      lastResult = await client.auth.signInWithPassword({ email: candidate, password });
      if (!lastResult.error) return lastResult;
    }
    return lastResult || { data: { user: null, session: null }, error: new Error("Código ou senha inválidos.") };
  }

  async function logout() {
    return client.auth.signOut();
  }

  async function changePassword(newPassword) {
    return client.auth.updateUser({ password: newPassword });
  }

  async function createAccount(displayName, loginCode, password, role) {
    return client.functions.invoke("admin-accounts", { body: { action: "create", displayName, loginCode, password, role } });
  }
  async function getBootstrapStatus() {
    return client.functions.invoke("admin-accounts", { body: { action: "bootstrap_status" } });
  }
  async function bootstrapAdmin(token, displayName, loginCode, password) {
    return client.functions.invoke("admin-accounts", { body: { action: "bootstrap", token, displayName, loginCode, password } });
  }

  async function getCurrentProfile() {
    const { data: sessionData } = await client.auth.getSession();
    const user = sessionData?.session?.user;
    if (!user) return null;
    const { data, error } = await client.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (!error && data) return data;
    return {
      id: user.id,
      login_code: user.user_metadata?.login_code || "",
      display_name: user.user_metadata?.display_name || user.email || "",
      role: "visualizador",
      active: true
    };
  }

  async function getAccounts() {
    const { data, error } = await client.from("profiles").select("*").order("display_name");
    if (error) throw error;
    return data || [];
  }

  async function updateAccount(id, changes) {
    const { error } = await client.from("profiles").update(changes).eq("id", id);
    if (error) throw error;
  }

  function onAuthChange(callback) {
    return client.auth.onAuthStateChange((_event, session) => callback(session?.user || null));
  }

  return { load, save, subscribe, login, logout, changePassword, createAccount, getBootstrapStatus, bootstrapAdmin, getCurrentProfile, getAccounts, updateAccount, onAuthChange, client };
})();
