window.logiFlowSync = (() => {
  const SUPABASE_URL = "https://eynhnuoiqumyjktwbvhw.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_evbgYU7X1rdKjC3dsiCm5w_hc3mRfzt";
  const TABLE = "shared_state";
  const ROW_ID = "logiflow-main";
  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  let saveTimer = null;

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

  return { load, save, subscribe };
})();
