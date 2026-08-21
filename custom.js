const customPortal = window.KarrarPortal;
const summaryItems = document.querySelector('#summaryItems');
const summaryTotal = document.querySelector('#summaryTotal');
const nextButton = document.querySelector('#nextStep');
const summaryNextButton = document.querySelector('#summaryNextStep');
const backButton = document.querySelector('#backStep');
const errorBox = document.querySelector('#customError');
const portalLink = document.querySelector('#portalLink');
const successModal = document.querySelector('#customSuccessModal');
const videoCountInput = document.querySelector('#customVideoCount');
const projectForms = document.querySelector('#customProjectForms');
const AI_SCENE_PRICE = 5;
const MIN_LENGTH = 5;
const MAX_LENGTH = 600;
const TOTAL_STEPS = 3;
const projectDrafts = new Map();
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
  portalLink.href = '/profile';
  document.querySelector('#customAuthNote').innerHTML = '<strong>Signed in</strong><span>This request will appear in <a href="/profile">My Projects</a>.</span>';
  document.querySelector('#customName').value ||= auth.profile?.full_name || auth.user.user_metadata?.full_name || '';
  document.querySelector('#customEmail').value = auth.user.email || '';
  document.querySelector('#customEmail').readOnly = true;
  document.querySelector('#customCompany').value ||= auth.profile?.company || '';
});

function escapeText(value = '') { const node = document.createElement('div'); node.textContent = value; return node.innerHTML; }
function field(id) { return document.querySelector(`#${id}`).value.trim(); }
function money(value) { return `$${Number(value || 0).toFixed(0)}`; }
function formatLength(seconds) {
  const total = Number(seconds) || 0;
  if (total < 60) return `${total}s`;
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return rest ? `${minutes}m ${rest}s` : `${minutes} min`;
}

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

function videoCount() {
  return Math.max(1, Math.min(20, Number(videoCountInput.value) || 1));
}

function syncProjectDrafts() {
  projectForms.querySelectorAll('[data-project-key]').forEach(block => {
    const draft = projectDrafts.get(block.dataset.projectKey) || {};
    block.querySelectorAll('[data-field]').forEach(control => { draft[control.dataset.field] = control.value.trim(); });
    projectDrafts.set(block.dataset.projectKey, draft);
  });
}

function renderProjectForms() {
  syncProjectDrafts();
  const count = videoCount();
  document.querySelector('#customStepTitle').textContent = count === 1 ? 'Tell Us About Your Video' : `Tell Us About Your ${count} Videos`;
  document.querySelector('#customStepIntro').textContent = count === 1
    ? 'Share the essentials for this video. You set the price you have in mind — we confirm the final quote after reviewing your footage.'
    : 'One block per video. Open and complete the details for each, and set the price you have in mind for it.';

  projectForms.innerHTML = Array.from({ length: count }, (_, index) => {
    const key = `custom-${index + 1}`;
    return `<details class="project-details" data-project-key="${key}"${index === 0 ? ' open' : ''}>
    <summary><span class="project-number">${String(index + 1).padStart(2, '0')}</span><span class="project-summary-copy"><strong>Video ${index + 1}</strong><small>Custom Project · <span data-unit-price>Your price</span></small></span><span class="project-chevron">⌄</span></summary>
    <div class="project-form-body"><div class="order-form-grid">
      <label class="wide"><span>Project Name *</span><input data-field="projectName" required maxlength="200" placeholder="e.g. 123 Ocean Drive Listing Video"></label>
      <label><span>Your Price ($)</span><input data-field="price" type="number" min="0" max="100000" step="1" placeholder="What you have in mind"></label>
      <label><span>Preferred Format</span><select data-field="format"><option>Vertical · 9:16</option><option>Landscape · 16:9</option><option>Square · 1:1</option><option>Multiple Formats</option></select></label>
      <label><span>Preferred Music</span><select data-field="music"><option value="">Select music</option><option>Custom Music</option><option>Pop</option><option>Rock</option><option>Hip-Hop</option><option>Jazz</option><option>Classical</option></select></label>
      <label class="wide" data-custom-music hidden><span>Custom Music *</span><input data-field="customMusic" maxlength="300" placeholder="Enter a song, artist, link, or music direction"></label>
      <div class="project-range-field"><div class="project-range-head"><span class="project-range-label">Aimed Length (Optional)</span><output class="project-range-value" data-aimed-output>${formatLength(MIN_LENGTH)}</output></div><input data-field="aimedLength" type="range" min="${MIN_LENGTH}" max="${MAX_LENGTH}" step="5"><div class="project-range-scale"><span>${formatLength(MIN_LENGTH)}</span><span>${formatLength(MAX_LENGTH)}</span></div></div>
      <label class="wide"><span>Color Profile (LOG/Camera)</span><input data-field="colorProfile" maxlength="200" placeholder="e.g. S-Log3, Canon C-Log, Standard, V-Log"></label>
      <label class="wide"><span>Footage / Cloud Storage Link</span><input data-field="footageLink" type="url" placeholder="https://drive.google.com/..."></label>
      <label class="wide"><span>Reference Video Link</span><input data-field="referenceLink" type="url" placeholder="https://..."></label>
      <div class="project-range-field"><div class="project-range-head"><span class="project-range-label">AI Add-On · $${AI_SCENE_PRICE}/Scene</span><output class="project-range-value" data-ai-output>Off</output></div><input data-field="aiScenes" type="range" min="0" max="5" step="1"><div class="project-range-scale"><span>Off</span><span>5 scenes</span></div></div>
      <label class="wide"><span>Creative notes and Script *</span><textarea data-field="notes" rows="7" required maxlength="10000" placeholder="Describe the style, pacing, music, branding, deliverables, and anything else we should know."></textarea></label>
    </div></div>
  </details>`;
  }).join('');

  Array.from({ length: count }, (_, index) => `custom-${index + 1}`).forEach(key => {
    const block = projectForms.querySelector(`[data-project-key="${key}"]`);
    const draft = projectDrafts.get(key) || {};
    if (!draft.format) draft.format = 'Vertical · 9:16';
    if (!draft.aimedLength) draft.aimedLength = String(MIN_LENGTH);
    if (draft.aiScenes === undefined) draft.aiScenes = '0';
    block.querySelectorAll('[data-field]').forEach(control => { control.value = draft[control.dataset.field] || ''; });
    block.querySelector('[data-custom-music]').hidden = draft.music !== 'Custom Music';
    projectDrafts.set(key, draft);
    updateProjectControls(block);
  });
  updateSummary();
}

function updateProjectControls(block) {
  const aimed = Number(block.querySelector('[data-field="aimedLength"]').value) || MIN_LENGTH;
  const scenes = Number(block.querySelector('[data-field="aiScenes"]').value) || 0;
  const price = Number(block.querySelector('[data-field="price"]').value) || 0;
  block.querySelector('[data-aimed-output]').textContent = formatLength(aimed);
  block.querySelector('[data-ai-output]').textContent = scenes ? `${scenes} scene${scenes === 1 ? '' : 's'} · +${money(scenes * AI_SCENE_PRICE)}` : 'Off';
  block.querySelector('[data-unit-price]').textContent = price || scenes ? money(price + scenes * AI_SCENE_PRICE) : 'Your price';
}

function projectDetails() {
  syncProjectDrafts();
  return Array.from({ length: videoCount() }, (_, index) => {
    const draft = projectDrafts.get(`custom-${index + 1}`) || {};
    const scenes = Number(draft.aiScenes || 0);
    return {
      number: index + 1,
      projectName: draft.projectName || '',
      price: Number(draft.price || 0),
      format: draft.format || '',
      music: draft.music === 'Custom Music' ? (draft.customMusic || '') : (draft.music || ''),
      isCustomMusic: draft.music === 'Custom Music',
      aimedLength: Number(draft.aimedLength || MIN_LENGTH),
      colorProfile: draft.colorProfile || '',
      aiScenes: scenes,
      aiPrice: scenes * AI_SCENE_PRICE,
      footageLink: draft.footageLink || '',
      referenceLink: draft.referenceLink || '',
      notes: draft.notes || ''
    };
  });
}

function updateSummary() {
  const projects = projectDetails();
  const total = projects.reduce((sum, p) => sum + p.price + p.aiPrice, 0);
  const priced = projects.some(p => p.price || p.aiScenes);
  summaryItems.innerHTML = projects.map(p =>
    `<div class="summary-line"><strong>${escapeText(p.projectName || `Video ${p.number}`)}</strong><span>${p.aiScenes ? `AI ×${p.aiScenes}` : 'Custom project'}</span><em>${p.price || p.aiPrice ? money(p.price + p.aiPrice) : '—'}</em></div>`
  ).join('') || '<p class="summary-empty">Add your project details to continue.</p>';
  summaryTotal.textContent = priced ? money(total) : 'To be quoted';
}

projectForms.addEventListener('change', event => {
  const music = event.target.closest('[data-field="music"]');
  if (!music) return;
  const block = music.closest('[data-project-key]');
  const custom = block.querySelector('[data-custom-music]');
  custom.hidden = music.value !== 'Custom Music';
  if (custom.hidden) custom.querySelector('input').value = '';
  syncProjectDrafts();
});

projectForms.addEventListener('input', event => {
  const control = event.target.closest('[data-field]');
  if (!control) return;
  const block = control.closest('[data-project-key]');
  syncProjectDrafts();
  updateProjectControls(block);
  updateSummary();
});

videoCountInput.addEventListener('input', () => {
  videoCountInput.value = String(videoCount());
  renderProjectForms();
});

function validateStep() {
  if (currentStep === 1) {
    if (!field('customName') || !field('customEmail')) return 'Enter your name and email address.';
    if (!document.querySelector('#customEmail').checkValidity()) return 'Enter a valid email address.';
    if (!validPhone()) return 'Enter a valid phone or WhatsApp number containing 7–15 digits.';
  }
  if (currentStep === 2) {
    const projects = projectDetails();
    const invalid = projects.findIndex(p => !p.projectName || !p.notes || (p.isCustomMusic && !p.music));
    if (invalid !== -1) {
      projectForms.querySelectorAll('.project-details')[invalid].open = true;
      return `Complete the required fields for Video ${invalid + 1}.`;
    }
    const badUrl = [...projectForms.querySelectorAll('input[type="url"]')].find(input => input.value && !input.checkValidity());
    if (badUrl) { badUrl.closest('.project-details').open = true; return 'Enter a valid footage or reference link.'; }
    // mirrors the database limits so a long brief fails here with a clear message
    const tooLong = projects.findIndex(p => p.notes.length > 10000 || p.projectName.length > 200);
    if (tooLong !== -1) {
      projectForms.querySelectorAll('.project-details')[tooLong].open = true;
      return `Video ${tooLong + 1}: shorten the project name (max 200) or creative notes (max 10,000 characters).`;
    }
  }
  if (currentStep === 3 && !document.querySelector('#customConsent').checked) return 'Confirm the quote-request statement before submitting.';
  return '';
}

function renderReview() {
  const projects = projectDetails();
  const total = projects.reduce((sum, p) => sum + p.price + p.aiPrice, 0);
  document.querySelector('#customReview').innerHTML = `
    <div class="review-block"><h2>Client</h2><p>${escapeText(field('customName'))} · ${escapeText(field('customEmail'))}</p><p>${escapeText(field('customPhone'))}${field('customCompany') ? ` · ${escapeText(field('customCompany'))}` : ''}</p></div>
    ${projects.map(p => `<div class="review-block"><span class="review-project-number">Video ${String(p.number).padStart(2, '0')} · Custom Project${p.price || p.aiPrice ? ` · ${money(p.price + p.aiPrice)}` : ''}</span><h2>${escapeText(p.projectName)}</h2>
      <p>${escapeText(p.format || 'Format to be discussed')} · Aimed length: ${formatLength(p.aimedLength)}</p>
      <p>Music: ${escapeText(p.music || 'To be discussed')}</p>
      <p>Color profile: ${escapeText(p.colorProfile || 'Not provided')}</p>
      <p>AI add-on: ${p.aiScenes ? `${p.aiScenes} scene${p.aiScenes === 1 ? '' : 's'} (+${money(p.aiPrice)})` : 'Off'}</p>
      <p>Your proposed price: ${p.price ? money(p.price) : 'To be quoted by Karrar Enterprises'}</p>
      <p>${escapeText(p.notes)}</p></div>`).join('')}
    <div class="review-block"><h2>Proposed Total</h2><p><strong>${total ? money(total) : 'To be quoted by Karrar Enterprises'}</strong></p></div>`;
}

function setNextButtons(text, disabled = false) {
  [nextButton, summaryNextButton].forEach(button => { button.textContent = text; button.disabled = disabled; });
}

function showStep(step) {
  currentStep = step;
  if (step === 2) renderProjectForms();
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
  const projects = projectDetails();
  const submissionId = typeof crypto.randomUUID === 'function' ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.floor(Math.random() * 16);
        return (c === 'x' ? r : (r & 3) | 8).toString(16);
      });

  setNextButtons('Submitting...', true);
  errorBox.textContent = '';

  if (!customPortal?.configured) {
    errorBox.textContent = 'Submission is unavailable right now. Please email karrarvisuals@gmail.com directly.';
    setNextButtons('Submit Request');
    return;
  }

  const rows = projects.map(p => ({
    client_id: auth?.user?.id || null,
    client_name: field('customName'),
    client_email: field('customEmail'),
    phone: field('customPhone'),
    company: field('customCompany') || null,
    project_name: p.projectName,
    service_name: 'Custom Project',
    format: p.format || null,
    preferred_music: p.music || null,
    color_profile: p.colorProfile || null,
    footage_link: p.footageLink || null,
    reference_link: p.referenceLink || null,
    creative_notes: p.notes,
    aimed_length: p.aimedLength,
    ai_addon_scenes: p.aiScenes,
    ai_addon_price: p.aiPrice,
    is_custom: true,
    client_budget: p.price || null,
    services: [{ id: 'custom', name: 'Custom Project', price: p.price, quantity: 1 }],
    estimated_total: 0,
    submission_id: submissionId,
    project_number: p.number,
    payment_status: 'unpaid',
    status: 'submitted'
  }));

  const { error } = await customPortal.client.from('projects').insert(rows);
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

renderProjectForms();
showStep(1);
