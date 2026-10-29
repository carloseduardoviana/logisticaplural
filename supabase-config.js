window.logiFlowSync = (() => {
  const SUPABASE_URL = "https://eynhnuoiqumyjktwbvhw.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_evbgYU7X1rdKjC3dsiCm5w_hc3mRfzt";
  const TABLE = "shared_state";
  const ROW_ID = "logiflow-main";
  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  let saveTimer = null;
  const loginEmail = (loginCode) => `${String(loginCode).trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "")}@logisticaplural.app`;

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
    return client.auth.signInWithPassword({
      email: loginEmail(loginCode),
      password
    });
  }

  async function logout() {
    return client.auth.signOut();
  }

  async function changePassword(newPassword) {
    return client.auth.updateUser({ password: newPassword });
  }

  async function createAccount(displayName, loginCode, password, role) {
    const email = loginEmail(loginCode);
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: {
          login_code: loginCode.trim(),
          display_name: displayName.trim(),
          role
        }
      }
    });
    if (!error && data?.session && data?.user) {
      const { error: profileError } = await client.from("profiles").insert({
        id: data.user.id,
        login_code: loginCode.trim(),
        display_name: displayName.trim(),
        role: "consulta",
        active: true
      });
      if (profileError) {
        return { data, error: profileError };
      }
    }
    return { data, error };
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
      role: user.user_metadata?.role || "consulta",
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

  return { load, save, subscribe, login, logout, changePassword, createAccount, getCurrentProfile, getAccounts, updateAccount, onAuthChange, client };
})();
