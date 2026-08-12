const orderServices = [
  { id: 'portrait1', name: 'Signature Edit', price: 260, duration: 'Vertical video', description: 'Signature style, premium finish, and polished storytelling.' },
  { id: 'portrait3', name: 'Listing Edit', price: 230, duration: 'Vertical video', description: 'Property storytelling, cinematic pacing, and social-ready delivery.' },
  { id: 'portrait4', name: 'Standard Branding', price: 120, duration: 'Vertical video', description: 'Clean graphics and a focused branded social edit.' },
  { id: 'portrait2', name: 'Advanced Branding', price: 170, duration: 'Vertical video', description: 'Brand storytelling, graphics, sound design, and social delivery.' },
  { id: 'portrait5', name: 'Commercial Edit', price: 230, duration: 'Vertical video', description: 'Premium commercial visuals with intentional pacing and sound.' },
  { id: 'portrait7', name: 'Yacht Edit', price: 260, duration: 'Vertical video', description: 'Luxury visuals, cinematic pacing, and premium sound design.' },
  { id: 'landscape2', name: 'Cinematic Edit', price: 230, duration: 'Landscape video', description: 'Wide-format property storytelling with a cinematic finish.' },
  { id: 'landscape1', name: 'Simple Edit', price: 120, duration: 'Landscape video', description: 'Clean landscape delivery with polished sound and pacing.' }
];

const selections = new Map();
let currentStep = 1;
const products = document.querySelector('#orderProducts');
const summaryItems = document.querySelector('#summaryItems');
const summaryTotal = document.querySelector('#summaryTotal');
const nextButton = document.querySelector('#nextStep');
const backButton = document.querySelector('#backStep');
const errorBox = document.querySelector('#orderError');

products.innerHTML = orderServices.map(service => {
  const video = window.KARRAR_VIDEOS?.[service.id] || '';
  return `<article class="order-product" data-id="${service.id}">
    <div class="order-product-media"><video src="${video}" autoplay muted loop playsinline preload="metadata"></video><button class="order-preview" type="button" aria-label="Open ${service.name} video"><span>▶</span></button></div>
    <h2>${service.name}</h2><div class="order-product-price">$${service.price}</div><p>${service.description}</p>
    <button class="order-select" type="button">Select</button>
    <div class="quantity-control"><button type="button" data-delta="-1" aria-label="Decrease quantity">−</button><span>1</span><button type="button" data-delta="1" aria-label="Increase quantity">+</button></div>
  </article>`;
}).join('');

function selectedServices() {
  return orderServices.filter(item => selections.has(item.id)).map(item => ({ ...item, quantity: selections.get(item.id) }));
}

function updateSummary() {
  const selected = selectedServices();
  const total = selected.reduce((sum, item) => sum + item.price * item.quantity, 0);
  summaryItems.innerHTML = selected.length ? selected.map(item => `<div class="summary-line"><strong>${item.name}</strong><span>Qty ${item.quantity}</span><em>$${item.price * item.quantity}</em></div>`).join('') : '<p class="summary-empty">Add a service to get started.</p>';
  summaryTotal.textContent = `$${total}`;
}

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
    selections.set(id, next); card.querySelector('.quantity-control span').textContent = next; updateSummary(); return;
  }
  if (event.target.closest('.order-select')) {
    if (selections.has(id)) selections.delete(id); else selections.set(id, 1);
    card.classList.toggle('selected', selections.has(id));
    card.querySelector('.order-select').textContent = selections.has(id) ? 'Selected' : 'Select';
    card.querySelector('.quantity-control span').textContent = selections.get(id) || 1;
    updateSummary();
  }
});

function field(id) { return document.querySelector(`#${id}`).value.trim(); }
function validateStep() {
  if (currentStep === 1 && !selections.size) return 'Select at least one editing service.';
  if (currentStep === 2 && (!field('clientName') || !field('clientEmail'))) return 'Enter your name and email address.';
  if (currentStep === 2 && !document.querySelector('#clientEmail').checkValidity()) return 'Enter a valid email address.';
  if (currentStep === 3 && (!field('projectName') || !field('projectNotes'))) return 'Enter the project name and creative notes.';
  if (currentStep === 4 && !document.querySelector('#orderConsent').checked) return 'Confirm the project-request statement before submitting.';
  return '';
}

function renderReview() {
  const services = selectedServices();
  const total = services.reduce((sum, item) => sum + item.price * item.quantity, 0);
  document.querySelector('#orderReview').innerHTML = `
    <div class="review-block"><h2>Selected Services</h2>${services.map(item => `<p>${item.name} × ${item.quantity} — $${item.price * item.quantity}</p>`).join('')}<p><strong>Estimated total: $${total}</strong></p></div>
    <div class="review-block"><h2>Client</h2><p>${field('clientName')} · ${field('clientEmail')}</p><p>${field('clientPhone') || 'No phone provided'}${field('clientCompany') ? ` · ${field('clientCompany')}` : ''}</p></div>
    <div class="review-block"><h2>Project</h2><p>${field('projectName')} · ${field('projectFormat')}</p><p>Deadline: ${field('projectDeadline') || 'To be discussed'}</p><p>${field('projectNotes')}</p></div>`;
}

function showStep(step) {
  currentStep = step;
  document.querySelectorAll('.order-step').forEach(section => section.classList.toggle('active', Number(section.dataset.step) === step));
  document.querySelectorAll('.order-progress li').forEach((item, index) => item.classList.toggle('active', index < step));
  document.querySelector('#progressBar').style.width = `${step * 25}%`;
  backButton.hidden = step === 1;
  nextButton.textContent = step === 4 ? 'Submit Project Request' : 'Continue';
  errorBox.textContent = '';
  if (step === 4) renderReview();
  scrollTo({ top: 0, behavior: 'smooth' });
}

function submitRequest() {
  const services = selectedServices();
  const total = services.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const body = [
    'NEW VIDEO EDITING PROJECT REQUEST', '',
    `Client: ${field('clientName')}`, `Email: ${field('clientEmail')}`, `Phone/WhatsApp: ${field('clientPhone') || 'Not provided'}`, `Company: ${field('clientCompany') || 'Not provided'}`, '',
    'SELECTED SERVICES', ...services.map(item => `- ${item.name} x ${item.quantity}: $${item.price * item.quantity}`), `Estimated Total: $${total}`, '',
    `Project: ${field('projectName')}`, `Format: ${field('projectFormat')}`, `Preferred Deadline: ${field('projectDeadline') || 'To be discussed'}`, `Footage Link: ${field('footageLink') || 'Not provided'}`, `Reference Link: ${field('referenceLink') || 'Not provided'}`, '',
    'CREATIVE NOTES', field('projectNotes')
  ].join('\n');
  window.location.href = `mailto:karrarvisuals@gmail.com?subject=${encodeURIComponent(`Project Request — ${field('projectName')}`)}&body=${encodeURIComponent(body)}`;
}

nextButton.addEventListener('click', () => { const error = validateStep(); if (error) { errorBox.textContent = error; return; } if (currentStep < 4) showStep(currentStep + 1); else submitRequest(); });
backButton.addEventListener('click', () => { if (currentStep > 1) showStep(currentStep - 1); });

const requested = new URLSearchParams(location.search).get('service');
if (requested && orderServices.some(item => item.id === requested)) {
  selections.set(requested, 1);
  const card = products.querySelector(`[data-id="${requested}"]`);
  card?.classList.add('selected');
  if (card) card.querySelector('.order-select').textContent = 'Selected';
  updateSummary();
}
