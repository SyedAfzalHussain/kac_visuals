const orderServices = [
  { id: 'portrait1', name: 'Signature Edit', price: 260, duration: 'Vertical video', minLength: 15, maxLength: 75, description: 'Signature style, premium finish, and polished storytelling.' },
  { id: 'portrait3', name: 'Listing Edit', price: 230, duration: 'Vertical video', minLength: 15, maxLength: 75, description: 'Property storytelling, cinematic pacing, and social-ready delivery.' },
  { id: 'portrait4', name: 'Standard Branding', price: 120, duration: 'Vertical video', minLength: 15, maxLength: 75, description: 'Clean graphics and a focused branded social edit.' },
  { id: 'portrait2', name: 'Advanced Branding', price: 170, duration: 'Vertical video', minLength: 15, maxLength: 75, description: 'Brand storytelling, graphics, sound design, and social delivery.' },
  { id: 'portrait5', name: 'Commercial Edit', price: 230, duration: 'Vertical video', minLength: 15, maxLength: 75, description: 'Premium commercial visuals with intentional pacing and sound.' },
  { id: 'portrait7', name: 'Yacht Edit', price: 260, duration: 'Vertical video', minLength: 15, maxLength: 75, description: 'Luxury visuals, cinematic pacing, and premium sound design.' },
  { id: 'landscape2', name: 'Cinematic Edit', price: 230, duration: 'Landscape video', minLength: 20, maxLength: 300, description: 'Wide-format property storytelling with a cinematic finish.' },
  { id: 'landscape1', name: 'Simple Edit', price: 120, duration: 'Landscape video', minLength: 20, maxLength: 120, description: 'Clean landscape delivery with polished sound and pacing.' }
];

const AI_SCENE_PRICE = 5;
const selections = new Map();
const projectDrafts = new Map();
let currentStep = 1;
const products = document.querySelector('#orderProducts');
const summaryItems = document.querySelector('#summaryItems');
const summaryTotal = document.querySelector('#summaryTotal');
const projectForms = document.querySelector('#projectForms');
const nextButton = document.querySelector('#nextStep');
const summaryNextButton = document.querySelector('#summaryNextStep');
const backButton = document.querySelector('#backStep');
const errorBox = document.querySelector('#orderError');
const phoneInput = document.querySelector('#clientPhone');
const portalLink = document.querySelector('#portalLink');
const orderPortal = window.KarrarPortal;
let signedInAuth = null;

portalLink.hidden = false;
portalLink.textContent = 'Login / Sign Up';

const orderAuth = (async () => {
  if (!orderPortal?.configured) return null;
  const user = await orderPortal.user();
  if (!user) return null;
  return { user, profile: await orderPortal.profile(user.id) };
})();

orderAuth.then(auth => {
  if (!auth) return;
  signedInAuth = auth;
  portalLink.textContent = 'My Projects';
  portalLink.href = '/profile/';
  document.querySelector('#orderAuthNote').innerHTML = `<strong>Signed in</strong><span>This request will appear in <a href="/profile/">My Projects</a>.</span>`;
  document.querySelector('#clientName').value ||= auth.profile?.full_name || auth.user.user_metadata?.full_name || auth.user.email?.split('@')[0] || '';
  document.querySelector('#clientEmail').value = auth.user.email || '';
  document.querySelector('#clientEmail').readOnly = true;
  document.querySelector('#clientCompany').value ||= auth.profile?.company || auth.user.user_metadata?.company || '';
});

phoneInput.addEventListener('input', () => {
  const firstDigit = phoneInput.value.search(/\d/);
  const leadingPlus = phoneInput.value.includes('+') && (firstDigit === -1 || phoneInput.value.indexOf('+') < firstDigit);
  const value = phoneInput.value.replace(/[^0-9+()\-\s]/g, '').replace(/\+/g, '');
  phoneInput.value = `${leadingPlus ? '+' : ''}${value.trimStart()}`;
});

function validPhone() {
  const value = field('clientPhone');
  const digitCount = value.replace(/\D/g, '').length;
  return /^\+?[0-9()\-\s]+$/.test(value) && digitCount >= 7 && digitCount <= 15;
}

products.innerHTML = orderServices.map(service => {
  const video = window.KARRAR_VIDEOS?.[service.id] || '';
  return `<article class="order-product" data-id="${service.id}">
    <div class="order-product-media"><video src="${video}" autoplay muted loop playsinline preload="metadata"></video><button class="order-preview" type="button" aria-label="Open ${service.name} video"><span>▶</span></button></div>
    <h2>${service.name}</h2><div class="order-product-price">$${service.price}</div><p>${service.description}</p>
    <button class="order-select" type="button">Select</button>
    <div class="quantity-control"><button type="button" data-delta="-1" aria-label="Decrease quantity">−</button><span>1</span><button type="button" data-delta="1" aria-label="Increase quantity">+</button></div>
  </article>`;
}).join('');

function escapeText(value = '') {
  const node = document.createElement('div');
  node.textContent = value;
  return node.innerHTML;
}

// 45 -> "45s", 90 -> "1m 30s", 120 -> "2 min"
function formatLength(seconds) {
  const total = Number(seconds) || 0;
  if (total < 60) return `${total}s`;
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return rest ? `${minutes}m ${rest}s` : `${minutes} min`;
}

function selectedServices() {
  return orderServices.filter(item => selections.has(item.id)).map(item => ({ ...item, quantity: selections.get(item.id) }));
}

function selectedProjectItems() {
  return selectedServices().flatMap(service => Array.from({ length: service.quantity }, (_, unitIndex) => ({
    key: `${service.id}-${unitIndex + 1}`,
    service,
    unitIndex: unitIndex + 1
  })));
}

function updateSummary() {
  const selected = selectedServices();
  const baseTotal = selected.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const aiScenes = selectedProjectItems().reduce((sum, item) => sum + Number(projectDrafts.get(item.key)?.aiScenes || 0), 0);
  const aiTotal = aiScenes * AI_SCENE_PRICE;
  const total = baseTotal + aiTotal;
  const serviceLines = selected.map(item => `<div class="summary-line"><strong>${item.name}</strong><span>Qty ${item.quantity}</span><em>$${item.price * item.quantity}</em></div>`).join('');
  const aiLine = aiScenes ? `<div class="summary-line"><strong>AI Add-On</strong><span>${aiScenes} scene${aiScenes === 1 ? '' : 's'}</span><em>+$${aiTotal}</em></div>` : '';
  summaryItems.innerHTML = selected.length ? `${serviceLines}${aiLine}` : '<p class="summary-empty">Add a service to get started.</p>';
  summaryTotal.textContent = `$${total}`;
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
  const items = selectedProjectItems();
  const count = items.length;
  document.querySelector('#projectStepTitle').textContent = count === 1 ? 'Tell Us About Your Video' : `Tell Us About Your ${count} Videos`;
  document.querySelector('#projectStepIntro').textContent = count === 1 ? 'Share the essentials for this video.' : 'One block per video. Open and complete the details for each project.';
  projectForms.innerHTML = items.map((item, index) => `<details class="project-details" data-project-key="${item.key}"${index === 0 ? ' open' : ''}>
    <summary><span class="project-number">${String(index + 1).padStart(2, '0')}</span><span class="project-summary-copy"><strong>Video ${index + 1}</strong><small>${item.service.name} · <span data-unit-price>$${item.service.price}</span></small></span><span class="project-chevron">⌄</span></summary>
    <div class="project-form-body"><div class="order-form-grid">
      <label class="wide"><span>Project Name *</span><input data-field="projectName" required></label>
      <label><span>Preferred Format</span><select data-field="format"><option>Vertical · 9:16</option><option>Landscape · 16:9</option><option>Square · 1:1</option><option>Multiple Formats</option></select></label>
      <label><span>Preferred Music</span><select data-field="music"><option value="">Select music</option><option>Custom Music</option><option>Pop</option><option>Rock</option><option>Hip-Hop</option><option>Jazz</option><option>Classical</option></select></label>
      <label class="wide" data-custom-music hidden><span>Custom Music *</span><input data-field="customMusic" placeholder="Enter a song, artist, link, or music direction"></label>
      <div class="project-range-field"><div class="project-range-head"><span class="project-range-label">Aimed Length (Optional)</span><output class="project-range-value" data-aimed-output>${formatLength(item.service.minLength)}</output></div><input data-field="aimedLength" type="range" min="${item.service.minLength}" max="${item.service.maxLength}" step="1"><div class="project-range-scale"><span>${formatLength(item.service.minLength)}</span><span>${formatLength(item.service.maxLength)}</span></div></div>
      <label class="wide"><span>Color Profile (LOG/Camera)</span><input data-field="colorProfile" placeholder="e.g. S-Log3, Canon C-Log, Standard, V-Log"></label>
      <label class="wide"><span>Footage / Cloud Storage Link</span><input data-field="footageLink" type="url" placeholder="https://drive.google.com/..."></label>
      <label class="wide"><span>Reference Video Link</span><input data-field="referenceLink" type="url" placeholder="https://..."></label>
      <div class="project-range-field"><div class="project-range-head"><span class="project-range-label">AI Add-On · $${AI_SCENE_PRICE}/Scene</span><output class="project-range-value" data-ai-output>Off</output></div><input data-field="aiScenes" type="range" min="0" max="5" step="1"><div class="project-range-scale"><span>Off</span><span>5 scenes</span></div></div>
      <label class="wide"><span>Creative notes and Script *</span><textarea data-field="notes" rows="7" required placeholder="Describe the style, pacing, music, branding, deliverables, and anything else we should know."></textarea></label>
    </div></div>
  </details>`).join('');

  items.forEach(item => {
    const block = projectForms.querySelector(`[data-project-key="${item.key}"]`);
    const draft = projectDrafts.get(item.key) || {};
    if (!draft.format) draft.format = item.service.duration.startsWith('Landscape') ? 'Landscape · 16:9' : 'Vertical · 9:16';
    if (!draft.aimedLength) draft.aimedLength = String(item.service.minLength);
    if (draft.aiScenes === undefined) draft.aiScenes = '0';
    block.querySelectorAll('[data-field]').forEach(control => { control.value = draft[control.dataset.field] || ''; });
    block.querySelector('[data-custom-music]').hidden = draft.music !== 'Custom Music';
    projectDrafts.set(item.key, draft);
    updateProjectControls(block, item);
  });
}

function updateProjectControls(block, item) {
  const aimedLength = Number(block.querySelector('[data-field="aimedLength"]').value);
  const aiScenes = Number(block.querySelector('[data-field="aiScenes"]').value);
  block.querySelector('[data-aimed-output]').textContent = formatLength(aimedLength);
  block.querySelector('[data-ai-output]').textContent = aiScenes ? `${aiScenes} scene${aiScenes === 1 ? '' : 's'} · +$${aiScenes * AI_SCENE_PRICE}` : 'Off';
  block.querySelector('[data-unit-price]').textContent = `$${item.service.price + aiScenes * AI_SCENE_PRICE}`;
}

projectForms.addEventListener('change', event => {
  const music = event.target.closest('[data-field="music"]');
  if (!music) return;
  const block = music.closest('[data-project-key]');
  const custom = block.querySelector('[data-custom-music]');
  custom.hidden = music.value !== 'Custom Music';
  if (custom.hidden) custom.querySelector('input').value = '';
});

projectForms.addEventListener('input', event => {
  const range = event.target.closest('input[type="range"][data-field]');
  if (!range) return;
  const block = range.closest('[data-project-key]');
  const item = selectedProjectItems().find(project => project.key === block.dataset.projectKey);
  syncProjectDrafts();
  updateProjectControls(block, item);
  if (range.dataset.field === 'aiScenes') updateSummary();
});

products.addEventListener('click', event => {
  const card = event.target.closest('.order-product');
  if (!card) return;
  const id = card.dataset.id;
  if (event.target.closest('.order-preview')) {
    const video = card.querySelector('video');
    const service = orderServices.find(item => item.id === id);
    window.KarrarVideoViewer?.open(video.currentSrc || video.src, service?.name, event.target.closest('.order-preview'));
    return;
  }
  const quantity = event.target.closest('[data-delta]');
  if (quantity) {
    const next = Math.max(1, Math.min(10, (selections.get(id) || 1) + Number(quantity.dataset.delta)));
    selections.set(id, next);
    card.querySelector('.quantity-control span').textContent = next;
    updateSummary();
    if (projectForms.children.length) renderProjectForms();
    return;
  }
  if (event.target.closest('.order-select')) {
    if (selections.has(id)) selections.delete(id); else selections.set(id, 1);
    card.classList.toggle('selected', selections.has(id));
    card.querySelector('.order-select').textContent = selections.has(id) ? 'Selected' : 'Select';
    card.querySelector('.quantity-control span').textContent = selections.get(id) || 1;
    updateSummary();
    if (projectForms.children.length) renderProjectForms();
  }
});

function field(id) { return document.querySelector(`#${id}`).value.trim(); }

function projectDetails() {
  syncProjectDrafts();
  return selectedProjectItems().map((item, index) => {
    const draft = projectDrafts.get(item.key) || {};
    return {
      ...item,
      number: index + 1,
      projectName: draft.projectName || '',
      format: draft.format || '',
      music: draft.music === 'Custom Music' ? (draft.customMusic || '') : (draft.music || ''),
      isCustomMusic: draft.music === 'Custom Music',
      aimedLength: Number(draft.aimedLength || item.service.minLength),
      colorProfile: draft.colorProfile || '',
      aiScenes: Number(draft.aiScenes || 0),
      aiPrice: Number(draft.aiScenes || 0) * AI_SCENE_PRICE,
      footageLink: draft.footageLink || '',
      referenceLink: draft.referenceLink || '',
      notes: draft.notes || ''
    };
  });
}

function validateStep() {
  if (currentStep === 1 && !selections.size) return 'Select at least one editing service.';
  if (currentStep === 2 && (!field('clientName') || !field('clientEmail'))) return 'Enter your name and email address.';
  if (currentStep === 2 && !document.querySelector('#clientEmail').checkValidity()) return 'Enter a valid email address.';
  if (currentStep === 3) {
    if (!validPhone()) return 'Enter a valid phone or WhatsApp number containing 7–15 digits.';
    const projects = projectDetails();
    const invalidIndex = projects.findIndex(project => !project.projectName || !project.notes || (project.isCustomMusic && !project.music));
    if (invalidIndex !== -1) {
      projectForms.querySelectorAll('.project-details')[invalidIndex].open = true;
      return `Complete the required fields for Video ${invalidIndex + 1}.`;
    }
    const invalidUrl = [...projectForms.querySelectorAll('input[type="url"]')].find(input => input.value && !input.checkValidity());
    if (invalidUrl) { invalidUrl.closest('.project-details').open = true; return 'Enter a valid footage or reference link.'; }
  }
  if (currentStep === 4 && !document.querySelector('#orderConsent').checked) return 'Confirm the project-request statement before submitting.';
  return '';
}

function renderReview() {
  const services = selectedServices();
  const projects = projectDetails();
  const total = projects.reduce((sum, project) => sum + project.service.price + project.aiPrice, 0);
  const aiScenes = projects.reduce((sum, project) => sum + project.aiScenes, 0);
  document.querySelector('#orderReview').innerHTML = `
    <div class="review-block"><h2>Selected Services</h2>${services.map(item => `<p>${escapeText(item.name)} × ${item.quantity} — $${item.price * item.quantity}</p>`).join('')}${aiScenes ? `<p>AI Add-On · ${aiScenes} scene${aiScenes === 1 ? '' : 's'} — $${aiScenes * AI_SCENE_PRICE}</p>` : ''}<p><strong>Estimated total: $${total}</strong></p></div>
    <div class="review-block"><h2>Client</h2><p>${escapeText(field('clientName'))} · ${escapeText(field('clientEmail'))}</p><p>${escapeText(field('clientPhone'))}${field('clientCompany') ? ` · ${escapeText(field('clientCompany'))}` : ''}</p></div>
    ${projects.map(project => `<div class="review-block"><span class="review-project-number">Video ${String(project.number).padStart(2, '0')} · ${escapeText(project.service.name)} · $${project.service.price + project.aiPrice}</span><h2>${escapeText(project.projectName)}</h2><p>${escapeText(project.format || 'Format to be discussed')} · Aimed length: ${formatLength(project.aimedLength)}</p><p>Music: ${escapeText(project.music || 'To be discussed')}</p><p>Color profile: ${escapeText(project.colorProfile || 'Not provided')}</p><p>AI add-on: ${project.aiScenes ? `${project.aiScenes} scene${project.aiScenes === 1 ? '' : 's'} (+$${project.aiPrice})` : 'Off'}</p><p>${escapeText(project.notes)}</p></div>`).join('')}`;
}

function setNextButtons(text, disabled = false) {
  [nextButton, summaryNextButton].forEach(button => {
    button.textContent = text;
    button.disabled = disabled;
  });
}

function showStep(step) {
  currentStep = step;
  if (step === 3) renderProjectForms();
  document.querySelectorAll('.order-step').forEach(section => section.classList.toggle('active', Number(section.dataset.step) === step));
  document.querySelectorAll('.order-progress li').forEach((item, index) => item.classList.toggle('active', index < step));
  document.querySelector('#progressBar').style.width = `${step * 25}%`;
  backButton.hidden = step === 1;
  setNextButtons(step === 4 ? 'Submit Project Request' : 'Continue');
  errorBox.textContent = '';
  if (step === 4) renderReview();
  scrollTo({ top: 0, behavior: 'smooth' });
}

async function submitRequest() {
  const projects = projectDetails();
  const total = projects.reduce((sum, project) => sum + project.service.price + project.aiPrice, 0);
  const auth = await orderAuth;
  const submissionId = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, character => {
    const random = Math.floor(Math.random() * 16);
    return (character === 'x' ? random : (random & 3) | 8).toString(16);
  });
  const body = [
    'NEW VIDEO EDITING PROJECT REQUEST', `Submission: ${submissionId}`, '',
    `Client: ${field('clientName')}`, `Email: ${field('clientEmail')}`, `Phone/WhatsApp: ${field('clientPhone') || 'Not provided'}`, `Company: ${field('clientCompany') || 'Not provided'}`, '',
    `PROJECTS (${projects.length})`, `Estimated Total: $${total}`, '',
    ...projects.flatMap(project => [
      `VIDEO ${String(project.number).padStart(2, '0')} — ${project.service.name} ($${project.service.price + project.aiPrice})`,
      `Project Name: ${project.projectName}`, `Format: ${project.format || 'To be discussed'}`, `Aimed Length: ${formatLength(project.aimedLength)}`, `Color Profile (LOG/Camera): ${project.colorProfile || 'Not provided'}`, `Preferred Music: ${project.music || 'To be discussed'}`, `AI Add-On: ${project.aiScenes ? `${project.aiScenes} scene${project.aiScenes === 1 ? '' : 's'} (+$${project.aiPrice})` : 'Off'}`, `Footage Link: ${project.footageLink || 'Not provided'}`, `Reference Link: ${project.referenceLink || 'Not provided'}`, `Creative notes and Script: ${project.notes}`, ''
    ])
  ].join('\n');

  setNextButtons('Saving Projects...', true);
  if (orderPortal?.configured) {
    const rows = projects.map(project => ({
      client_id: auth?.user?.id || null,
      client_name: field('clientName'),
      client_email: field('clientEmail'),
      phone: field('clientPhone') || null,
      company: field('clientCompany') || null,
      project_name: project.projectName,
      format: project.format || null,
      preferred_music: project.music || null,
      footage_link: project.footageLink || null,
      reference_link: project.referenceLink || null,
      creative_notes: project.notes,
      services: [{ id: project.service.id, name: project.service.name, price: project.service.price, quantity: 1, aimedLength: project.aimedLength, colorProfile: project.colorProfile, aiScenes: project.aiScenes, aiPrice: project.aiPrice }],
      estimated_total: project.service.price + project.aiPrice,
      submission_id: submissionId,
      project_number: project.number,
      service_id: project.service.id,
      service_name: project.service.name,
      unit_price: project.service.price,
      aimed_length: project.aimedLength,
      color_profile: project.colorProfile || null,
      ai_addon_scenes: project.aiScenes,
      ai_addon_price: project.aiPrice,
      payment_status: 'unpaid',
      status: 'submitted',
      admin_notes: null
    }));
    const { error } = await orderPortal.client.from('projects').insert(rows);
    if (error) {
      errorBox.textContent = `Your projects could not be saved: ${error.message}`;
      setNextButtons('Submit Project Request');
      return;
    }
  }

  const form = document.createElement('form');
  form.method = 'POST';
  form.action = 'https://api.web3forms.com/submit';
  form.hidden = true;
  const fields = {
    access_key: '4bf845f0-5cd9-4115-9aea-60643021b831',
    subject: `New Project Request — ${projects.length} Video${projects.length === 1 ? '' : 's'} — ${field('clientName')}`,
    from_name: 'Karrar Enterprises Website',
    name: field('clientName'),
    email: field('clientEmail'),
    replyto: field('clientEmail'),
    phone: field('clientPhone') || 'Not provided',
    company: field('clientCompany') || 'Not provided',
    submission_id: submissionId,
    message: body,
    redirect: `${location.origin}/project-submitted/`
  };
  Object.entries(fields).forEach(([name, value]) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  });
  document.body.appendChild(form);
  setNextButtons('Submitting...', true);
  errorBox.textContent = '';
  form.submit();
}

async function advanceOrder() {
  const error = validateStep();
  if (error) { errorBox.textContent = error; return; }
  if (currentStep === 1) {
    const auth = await orderAuth;
    showStep(auth ? 3 : 2);
  } else if (currentStep < 4) showStep(currentStep + 1);
  else submitRequest();
}
nextButton.addEventListener('click', advanceOrder);
summaryNextButton.addEventListener('click', advanceOrder);
backButton.addEventListener('click', () => {
  if (currentStep === 3 && signedInAuth) showStep(1);
  else if (currentStep > 1) showStep(currentStep - 1);
});

const successModal = document.querySelector('#orderSuccessModal');
function closeSuccessModal() {
  successModal.hidden = true;
  document.body.classList.remove('order-success-open');
  nextButton.focus();
}
successModal.addEventListener('click', event => { if (event.target.closest('[data-close-success]')) closeSuccessModal(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !successModal.hidden) closeSuccessModal(); });

const requested = new URLSearchParams(location.search).get('service');
if (requested && orderServices.some(item => item.id === requested)) {
  selections.set(requested, 1);
  const card = products.querySelector(`[data-id="${requested}"]`);
  card?.classList.add('selected');
  if (card) card.querySelector('.order-select').textContent = 'Selected';
  updateSummary();
}
