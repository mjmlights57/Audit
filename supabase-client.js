(function initializeSupabase() {
  const config = window.EWPROS_CONFIG;

  if (!config) {
    console.error("EWPros Supabase configuration was not loaded.");
    return;
  }

  if (!config.supabaseUrl || !config.supabasePublishableKey) {
    console.error("Supabase URL or publishable key is missing.");
    return;
  }

  if (
    config.supabaseUrl === "YOUR_SUPABASE_PROJECT_URL" ||
    config.supabasePublishableKey === "YOUR_SUPABASE_PUBLISHABLE_KEY"
  ) {
    console.warn("Replace the Supabase placeholders in supabase-config.js before testing the connection.");
    return;
  }

  if (!window.supabase?.createClient) {
    console.error("Supabase JavaScript library failed to load.");
    return;
  }

  window.ewprosSupabase = window.supabase.createClient(
    config.supabaseUrl,
    config.supabasePublishableKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );

  console.log("EWPros Supabase client initialized.");
})();
