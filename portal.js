(() => {
  const config = window.KARRAR_PORTAL_CONFIG || {};
  const configured = Boolean(config.supabaseUrl && config.supabaseAnonKey && window.supabase?.createClient);
  const client = configured ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey) : null;

  function safeNext(fallback = '/profile/') {
    const next = new URLSearchParams(location.search).get('next');
    return next && next.startsWith('/') && !next.startsWith('//') ? next : fallback;
  }

  async function user() {
    if (!client) return null;
    const { data, error } = await client.auth.getUser();
    if (error) return null;
    return data.user;
  }

  async function profile(id) {
    if (!client || !id) return null;
    const { data } = await client.from('profiles').select('*').eq('id', id).single();
    return data;
  }

  async function requireUser(options = {}) {
    if (!configured) {
      location.replace('/login/?setup=required');
      return null;
    }
    const currentUser = await user();
    if (!currentUser) {
      location.replace(`/login/?next=${encodeURIComponent(location.pathname + location.search)}`);
      return null;
    }
    if (options.admin) {
      const currentProfile = await profile(currentUser.id);
      if (currentProfile?.role !== 'admin') {
        location.replace('/profile/');
        return null;
      }
      return { user: currentUser, profile: currentProfile };
    }
    return { user: currentUser, profile: await profile(currentUser.id) };
  }

  async function signOut() {
    if (client) await client.auth.signOut();
    location.replace('/login/');
  }

  window.KarrarPortal = { config, configured, client, safeNext, user, profile, requireUser, signOut };
})();
