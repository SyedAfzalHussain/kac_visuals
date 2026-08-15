const portal = window.KarrarPortal;
const message = document.querySelector('#authMessage');
const setupNotice = document.querySelector('#setupNotice');
const tabs = document.querySelectorAll('[data-auth-tab]');
const signinForm = document.querySelector('#signinForm');
const signupForm = document.querySelector('#signupForm');
const resetForm = document.querySelector('#resetForm');
const authRedirect = `${portal.config.siteUrl || location.origin}/login/`;
let recoveryMode = new URLSearchParams(location.search).get('mode') === 'recovery' || new URLSearchParams(location.hash.slice(1)).get('type') === 'recovery';

function setMessage(text, type = '') {
  message.textContent = text;
  message.className = `portal-message ${type}`;
}

function showTab(name) {
  tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.authTab === name));
  signinForm.hidden = name !== 'signin';
  signupForm.hidden = name !== 'signup';
  resetForm.hidden = name !== 'reset';
  document.querySelector('.auth-tabs').hidden = name === 'reset';
  setMessage('');
}

tabs.forEach(tab => tab.addEventListener('click', () => showTab(tab.dataset.authTab)));
if (recoveryMode) {
  showTab('reset');
  setMessage('Choose a new password for your account.');
}

if (!portal.configured) {
  setupNotice.hidden = false;
  document.querySelectorAll('form button').forEach(button => button.disabled = true);
} else {
  portal.client.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      recoveryMode = true;
      showTab('reset');
      setMessage('Choose a new password for your account.');
    }
  });
  setTimeout(() => portal.user().then(user => {
    if (user && !recoveryMode) location.replace(portal.safeNext());
  }), 250);
}

signinForm.addEventListener('submit', async event => {
  event.preventDefault();
  setMessage('Signing in...');
  const { error } = await portal.client.auth.signInWithPassword({ email: document.querySelector('#signinEmail').value.trim(), password: document.querySelector('#signinPassword').value });
  if (error) return setMessage(error.message, 'error');
  location.replace(portal.safeNext());
});

signupForm.addEventListener('submit', async event => {
  event.preventDefault();
  setMessage('Creating your account...');
  const email = document.querySelector('#signupEmail').value.trim();
  const { data, error } = await portal.client.auth.signUp({ email, password: document.querySelector('#signupPassword').value, options: { data: { full_name: document.querySelector('#signupName').value.trim(), company: document.querySelector('#signupCompany').value.trim() }, emailRedirectTo: authRedirect } });
  if (error) return setMessage(error.message, 'error');
  if (data.session) location.replace(portal.safeNext());
  else setMessage('Account created. Check your email to confirm your account, then sign in.', 'success');
});

document.querySelector('#forgotPassword').addEventListener('click', async () => {
  const email = document.querySelector('#signinEmail').value.trim();
  if (!email) return setMessage('Enter your email address first.', 'error');
  const { error } = await portal.client.auth.resetPasswordForEmail(email, { redirectTo: `${authRedirect}?mode=recovery` });
  setMessage(error ? error.message : 'Password reset instructions have been sent.', error ? 'error' : 'success');
});

resetForm.addEventListener('submit', async event => {
  event.preventDefault();
  const { error } = await portal.client.auth.updateUser({ password: document.querySelector('#resetPassword').value });
  if (error) return setMessage(error.message, 'error');
  setMessage('Password updated. Redirecting to your projects...', 'success');
  setTimeout(() => location.replace('/profile/'), 900);
});
