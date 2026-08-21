const customPortal = window.KarrarPortal;
const summaryItems = document.querySelector('#summaryItems');
const summaryTotal = document.querySelector('#summaryTotal');
const nextButton = document.querySelector('#nextStep');
const summaryNextButton = document.querySelector('#summaryNextStep');
const backButton = document.querySelector('#backStep');
const errorBox = document.querySelector('#customError');
const portalLink = document.querySelector('#portalLink');
const successModal = document.querySelector('#customSuccessModal');
const TOTAL_STEPS = 3;
let currentStep = 1;

portalLink.hidden = false;
portalLink.textContent = 'Login / Sign Up';

const customAuth = (async () => {
  if (!customPortal?.configured) return null;
  const user = await customPortal.user();
  if (!user) return null;
  return { user, profile: await customPortal.profile(user.id) };
})();

customAuth.then(auth => {
  if (!auth) return;
  portalLink.textContent = 'My Projects';
  portalLink.href = '/profile/';
  document.querySelector('#customAuthNote').innerHTML = '<strong>Signed in</strong><span>This request will appear in <a href="/profile/">My Projects</a>.</span>';
  document.querySelector('#customName').value ||= auth.profile?.full_name || auth.user.user_metadata?.full_name || '';
  document.querySelector('#customEmail').value = auth.user.email || '';
  document.querySelector('#customEmail').readOnly = true;
  document.querySelector('#customCompany').value ||= auth.profile?.company || '';
});

function escapeText(value = '') { const node = document.createElement('div'); node.textContent = value; return node.innerHTML; }
function field(id) { return document.querySelector(`#${id}`).value.trim(); }
function money(value) { return `$${Number(value || 0).toFixed(0)}`; }

const phoneInput = document.querySelector('#customPhone');
phoneInput.addEventListener('input', () => {
  const firstDigit = phoneInput.value.search(/\d/);
  const leadingPlus = phoneInput.value.includes('+') && (firstDigit === -1 || phoneInput.value.indexOf('+') < firstDigit);
  const value = phoneInput.value.replace(/[^0-9+()\-\s]/g, '').replace(/\+/g, '');
  phoneInput.value = `${leadingPlus ? '+' : ''}${value.trimStart()}`;
});

function validPhone() {
  const value = field('customPhone');
  const digits = value.replace(/\D/g, '').length;
  return /^\+?[0-9()\-\s]+$/.test(value) && digits >= 7 && digits <= 15;
}

function updateSummary() {
  const name = field('customName');
  const projectName = field('customProjectName');
  const videos = Number(field('customVideoCount')) || 0;
  const budget = field('customBudget');
  const lines = [
    projectName && `<div class="summary-line"><strong>${escapeText(projectName)}</strong><span>Custom project</span></div>`,
    videos && `<div class="summary-line"><strong>Videos</strong><span>Quantity</span><em>${videos}</em></div>`,
    name && `<div class="summary-line"><strong>${escapeText(name)}</strong><span>${escapeText(field('customEmail') || 'Contact')}</span></div>`
  ].filter(Boolean).join('');
  summaryItems.innerHTML = lines || '<p class="summary-empty">Complete your details to continue.</p>';
  summaryTotal.textContent = budget ? money(budget) : 'To be quoted';
}

document.addEventListener('input', event => {
  if (event.target.closest('.order-form-grid')) updateSummary();
});

function validateStep() {
  if (currentStep === 1) {
    if (!field('customName') || !field('customEmail')) return 'Enter your name and email address.';
    if (!document.querySelector('#customEmail').checkValidity()) return 'Enter a valid email address.';
    if (!validPhone()) return 'Enter a valid phone or WhatsApp number containing 7–15 digits.';
  }
  if (currentStep === 2) {
    if (!field('customProjectName') || !field('customDetails')) return 'Project name and description are required.';
    const videos = Number(field('customVideoCount'));
    if (!videos || videos < 1) return 'Enter how many videos you need.';
    const invalidUrl = [...document.querySelectorAll('.order-step[data-step="2"] input[type="url"]')].find(input => input.value && !input.checkValidity());
    if (invalidUrl) return 'Enter a valid files link, or leave it empty.';
  }
  if (currentStep === 3 && !document.querySelector('#customConsent').checked) return 'Confirm the quote-request statement before submitting.';
  return '';
}

function renderReview() {
  const budget = field('customBudget');
  document.querySelector('#customReview').innerHTML = `
    <div class="review-block"><h2>Client</h2><p>${escapeText(field('customName'))} · ${escapeText(field('customEmail'))}</p><p>${escapeText(field('customPhone'))}${field('customCompany') ? ` · ${escapeText(field('customCompany'))}` : ''}</p></div>
    <div class="review-block"><span class="review-project-number">Custom Project</span><h2>${escapeText(field('customProjectName'))}</h2>
      <p>Number of videos: ${escapeText(field('customVideoCount') || '1')}</p>
      <p>Proposed budget: ${budget ? escapeText(money(budget)) : 'To be quoted by Karrar Enterprises'}</p>
      <p>Reference videos: ${escapeText(field('customReference') || 'Not provided')}</p>
      <p>Files link: ${escapeText(field('customFilesLink') || 'Not provided')}</p>
      <p>${escapeText(field('customDetails'))}</p>
      ${field('customComments') ? `<p>Anything else: ${escapeText(field('customComments'))}</p>` : ''}
    </div>`;
}

function setNextButtons(text, disabled = false) {
  [nextButton, summaryNextButton].forEach(button => { button.textContent = text; button.disabled = disabled; });
}

function showStep(step) {
  currentStep = step;
  document.querySelectorAll('.order-step').forEach(section => section.classList.toggle('active', Number(section.dataset.step) === step));
  document.querySelectorAll('.order-progress li').forEach((item, index) => item.classList.toggle('active', index < step));
  document.querySelector('#progressBar').style.width = `${(step / TOTAL_STEPS) * 100}%`;
  backButton.hidden = step === 1;
  setNextButtons(step === TOTAL_STEPS ? 'Submit Request' : 'Continue');
  errorBox.textContent = '';
  if (step === TOTAL_STEPS) renderReview();
  scrollTo({ top: 0, behavior: 'smooth' });
}

async function submitRequest() {
  const auth = await customAuth;
  const videos = Number(field('customVideoCount')) || 1;
  const budget = field('customBudget');
  const notes = [
    field('customDetails'),
    `Number of videos requested: ${videos}`,
    budget && `Client proposed budget: ${money(budget)}`,
    field('customComments') && `Anything else: ${field('customComments')}`
  ].filter(Boolean).join('\n\n');

  setNextButtons('Submitting...', true);
  errorBox.textContent = '';

  if (!customPortal?.configured) {
    errorBox.textContent = 'Submission is unavailable right now. Please email karrarvisuals@gmail.com directly.';
    setNextButtons('Submit Request');
    return;
  }

  const { error } = await customPortal.client.from('projects').insert([{
    client_id: auth?.user?.id || null,
    client_name: field('customName'),
    client_email: field('customEmail'),
    phone: field('customPhone'),
    company: field('customCompany') || null,
    project_name: field('customProjectName'),
    service_name: 'Custom Quote Request',
    creative_notes: notes,
    footage_link: field('customFilesLink') || null,
    reference_link: field('customReference') || null,
    is_custom: true,
    client_budget: budget ? Number(budget) : null,
    services: [{ id: 'custom', name: 'Custom Project', price: 0, quantity: videos }],
    estimated_total: 0,
    // Required by the projects table's insert check; not meaningful for a custom quote.
    aimed_length: 60,
    ai_addon_scenes: 0,
    ai_addon_price: 0,
    payment_status: 'unpaid',
    status: 'submitted'
  }]);

  if (error) {
    errorBox.textContent = `Your request could not be saved: ${error.message}`;
    setNextButtons('Submit Request');
    return;
  }

  successModal.hidden = false;
  document.body.classList.add('order-success-open');
}

function advance() {
  const error = validateStep();
  if (error) { errorBox.textContent = error; return; }
  if (currentStep < TOTAL_STEPS) showStep(currentStep + 1);
  else submitRequest();
}

nextButton.addEventListener('click', advance);
summaryNextButton.addEventListener('click', advance);
backButton.addEventListener('click', () => { if (currentStep > 1) showStep(currentStep - 1); });

updateSummary();
showStep(1);
