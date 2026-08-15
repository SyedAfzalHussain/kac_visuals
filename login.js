const portal = window.KarrarPortal;
const message = document.querySelector('#authMessage');
const setupNotice = document.querySelector('#setupNotice');
const tabs = document.querySelectorAll('[data-auth-tab]');
const signinForm = document.querySelector('#signinForm');
const signupForm = document.querySelector('#signupForm');
const resetForm = document.querySelector('#resetForm');
const socialAuth = document.querySelector('#socialAuth');
const googleButton = document.querySelector('#googleSignIn');
const authRedirect = `${portal.config.siteUrl || location.origin}/login/`;
let recoveryMode = new URLSearchParams(location.search).get('mode') === 'recovery' || new URLSearchParams(location.hash.slice(1)).get('type') === 'recovery';
let redirecting = false;
const callbackHash = new URLSearchParams(location.hash.slice(1));
const callbackQuery = new URLSearchParams(location.search);
const callbackError = callbackHash.get('error_description') || callbackQuery.get('error_description');

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
  socialAuth.hidden = name === 'reset';
  setMessage('');
}

function nextDestination() {
  const stored = sessionStorage.getItem('karrar_oauth_next');
  if (stored) sessionStorage.removeItem('karrar_oauth_next');
  return stored || portal.safeNext();
}

function finishSignIn() {
  if (redirecting || recoveryMode) return;
  redirecting = true;
  setMessage('Signed in. Opening your projects...', 'success');
  setTimeout(() => location.replace(nextDestination()), 0);
}

tabs.forEach(tab => tab.addEventListener('click', () => showTab(tab.dataset.authTab)));
if (recoveryMode) {
  showTab('reset');
  setMessage('Choose a new password for your account.');
} else if (callbackError) {
  setMessage(callbackError, 'error');
}

if (!portal.configured) {
  setupNotice.hidden = false;
  document.querySelectorAll('form button').forEach(button => button.disabled = true);
  googleButton.disabled = true;
} else {
  portal.client.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      recoveryMode = true;
      showTab('reset');
      setMessage('Choose a new password for your account.');
    } else if (event === 'SIGNED_IN' && session?.user) {
      finishSignIn();
    }
  });
  portal.client.auth.getSession().then(({ data }) => {
    if (data.session?.user) finishSignIn();
  });
}

signinForm.addEventListener('submit', async event => {
  event.preventDefault();
  setMessage('Signing in...');
  const { error } = await portal.client.auth.signInWithPassword({ email: document.querySelector('#signinEmail').value.trim(), password: document.querySelector('#signinPassword').value });
  if (error) return setMessage(error.message, 'error');
  finishSignIn();
});

googleButton.addEventListener('click', async () => {
  if (!portal.configured) return setMessage('Google sign-in is not configured.', 'error');
  sessionStorage.setItem('karrar_oauth_next', portal.safeNext());
  googleButton.disabled = true;
  setMessage('Opening Google sign-in...');
  const { error } = await portal.client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: authRedirect } });
  if (error) {
    sessionStorage.removeItem('karrar_oauth_next');
    googleButton.disabled = false;
    setMessage(error.message, 'error');
  }
});

signupForm.addEventListener('submit', async event => {
  event.preventDefault();
  setMessage('Creating your account...');
  const email = document.querySelector('#signupEmail').value.trim();
  const { data, error } = await portal.client.auth.signUp({ email, password: document.querySelector('#signupPassword').value, options: { data: { full_name: document.querySelector('#signupName').value.trim(), company: document.querySelector('#signupCompany').value.trim() }, emailRedirectTo: authRedirect } });
  if (error) return setMessage(error.message, 'error');
  if (data.session) finishSignIn();
  else setMessage('Account created. Check your email to confirm your account, then sign in.', 'success');
});

document.querySelector('#forgotPassword').addEventListener('click', async () => {
  const email = document.querySelector('#signinEmail').value.trim();
  if (!email) return setMessage('Enter your email address first.', 'error');
  const { error } = await portal.client.auth.resetPasswordForEmail(email, { redirectTo: authRedirect });
  setMessage(error ? error.message : 'Password reset instructions have been sent.', error ? 'error' : 'success');
});

resetForm.addEventListener('submit', async event => {
  event.preventDefault();
  const { error } = await portal.client.auth.updateUser({ password: document.querySelector('#resetPassword').value });
  if (error) return setMessage(error.message, 'error');
  setMessage('Password updated. Redirecting to your projects...', 'success');
  setTimeout(() => location.replace('/profile/'), 900);
});
