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

  // The profiles row is read through row security, so it can come back empty
  // (missing row, policy change, stale schema cache) — and an empty read used
  // to read as "client", which is how a promoted editor kept landing in the
  // client portal with no assignments. my_role() is SECURITY DEFINER, so it
  // answers even when the row read does not; the row still supplies the name
  // and company. Falls back to the row when my_role() is not installed yet.
  async function profile(id) {
    if (!client || !id) return null;
    const [row, role] = await Promise.all([
      client.from('profiles').select('*').eq('id', id).maybeSingle(),
      client.rpc('my_role')
    ]);
    if (row.error) console.error('[portal] profile read failed:', row.error.message);
    if (role.error) console.error('[portal] my_role failed:', role.error.message);
    const authoritative = typeof role.data === 'string' ? role.data : null;
    if (!row.data) return authoritative ? { id, role: authoritative } : null;
    return authoritative ? { ...row.data, role: authoritative } : row.data;
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

  // Pages start behind an opaque overlay so a privileged shell never paints
  // for someone who turns out not to be allowed to see it. Each page calls
  // this only once it is satisfied with the role it got back.
  function releaseGate() { document.querySelector('#authGate')?.remove(); }

  window.KarrarPortal = { config, configured, client, safeNext, user, profile, requireUser, signOut, releaseGate };
})();
