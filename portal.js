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

  // --- Copy-to-clipboard, shared by every portal -----------------------------
  function escapeAttr(value = '') {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Renders nothing when there is nothing to copy, so callers can inline it.
  function copyButton(value, label = 'Copy') {
    if (!value) return '';
    return `<button class="copy-button" type="button" data-copy="${escapeAttr(value)}" title="${escapeAttr(label)}" aria-label="${escapeAttr(label)}"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg></button>`;
  }

  async function writeClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch { /* insecure context, or the user denied permission */ }
    try {
      // execCommand is deprecated but still the only fallback that works
      // without clipboard permission.
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(area);
      area.select();
      const copied = document.execCommand('copy');
      area.remove();
      return copied;
    } catch { return false; }
  }

  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-copy]');
    if (!button) return;
    event.preventDefault();
    const copied = await writeClipboard(button.dataset.copy);
    button.classList.add(copied ? 'copied' : 'copy-failed');
    button.setAttribute('aria-label', copied ? 'Copied' : 'Copy failed');
    setTimeout(() => {
      button.classList.remove('copied', 'copy-failed');
      button.setAttribute('aria-label', 'Copy');
    }, 1400);
  });

  async function signOut() {
    if (client) await client.auth.signOut();
    location.replace('/login/');
  }

  // Pages start behind an opaque overlay so a privileged shell never paints
  // for someone who turns out not to be allowed to see it. Each page calls
  // this only once it is satisfied with the role it got back.
  function releaseGate() { document.querySelector('#authGate')?.remove(); }

  window.KarrarPortal = { config, configured, client, safeNext, user, profile, requireUser, signOut, releaseGate, copyButton, escapeAttr };
})();
