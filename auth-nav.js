// Swaps the "Login / Sign Up" nav button for "My Projects" when the visitor
// already has a session.
//
// This reads the session Supabase stores in localStorage rather than loading
// the Supabase SDK, so the marketing pages stay light. It is only a hint for
// the label — /profile still verifies the session server-side and bounces the
// visitor to /login if the token turns out to be stale or revoked.
(() => {
  function storedSession() {
    let store;
    try { store = window.localStorage; } catch { return null; }   // blocked in some privacy modes
    if (!store) return null;

    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i);
      if (!key || !/^sb-.+-auth-token$/.test(key)) continue;
      let raw = store.getItem(key);
      if (!raw) continue;
      try {
        // newer supabase-js versions prefix the JSON with "base64-"
        if (raw.startsWith('base64-')) raw = atob(raw.slice(7));
        const parsed = JSON.parse(raw);
        const session = parsed?.currentSession || parsed;
        if (!session?.access_token) continue;
        const expiresAt = Number(session.expires_at || 0);
        if (expiresAt && expiresAt * 1000 <= Date.now()) continue;  // expired
        return session;
      } catch { /* malformed entry — keep looking */ }
    }
    return null;
  }

  function applyTo(root) {
    root.querySelectorAll('a[href="/login"], a[href="/login/"]').forEach(link => {
      if (link.dataset.authSwapped) return;
      link.dataset.authSwapped = 'true';
      link.textContent = 'My Projects';
      link.setAttribute('href', '/profile');
      link.setAttribute('aria-label', 'Open your client portal');
    });
  }

  function run() { if (storedSession()) applyTo(document); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
  // a sign-out in another tab should put the button back on next focus
  addEventListener('pageshow', run);
})();
