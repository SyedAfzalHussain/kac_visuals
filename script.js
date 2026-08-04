const packages = [
  ['Signature Edit', '$300', ['Signature Style', 'Premium Finish', 'Portfolio Sample'], 'signature', 'assets/karrar/signature.jpg'],
  ['Branding Edit', '$170', ['Brand Storytelling', 'Clean Graphics', 'Social Ready'], 'branding', 'assets/karrar/branding.jpg'],
  ['Yacht Edit', '$260', ['Luxury Visuals', 'Cinematic Pacing', 'Premium Sound Design'], 'yacht', 'assets/karrar/yacht.jpg']
];
if (window.KARRAR_VIDEOS?.hero) document.querySelector('#heroVideo').src = window.KARRAR_VIDEOS.hero;
if (window.KARRAR_VIDEOS?.footer) document.querySelector('#footerVideo').src = window.KARRAR_VIDEOS.footer;
const packageGrid = document.querySelector('#packageGrid');
packageGrid.innerHTML = packages.map(([name, price, features, key, poster]) => {
  const videoUrl = window.KARRAR_VIDEOS?.[key];
  const media = videoUrl ? `<video src="${videoUrl}" poster="${poster}" autoplay muted loop playsinline preload="metadata"></video>` : `<img src="${poster}" alt="${name} preview" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">`;
  return `
  <article class="package-card reveal" style="grid-column:auto">
    <div class="package-visual" tabindex="0" role="button" aria-label="Play ${name} preview">
      ${media}
      <div class="package-overlay"></div><span class="play-icon">▶</span>
      <div class="package-info"><h3>${name}</h3><p class="package-price">${price}</p><ul>${features.map(f => `<li>${f}</li>`).join('')}</ul></div>
      ${videoUrl ? '<button class="sound-button" type="button" aria-label="Unmute preview">⌁</button>' : ''}
    </div>
    <button class="package-select" type="button" data-service="${key}">Book Now</button>
  </article>`;
}).join('');

const logos = ['CohenCo_White.png','KNOWN-WHITE-768x884.png','Studio-910.png','Studio-Sunday-768x573.png','JT_visuals-768x360.png','Akbar.png','RESONATE_white-768x169.png','Eric-Visuals.png'];
const logoTrack = document.querySelector('#logoTrack');
logoTrack.innerHTML = [...logos, ...logos].map(name => `<img src="assets/logos/${name}" alt="Client logo" />`).join('');

const testimonials = [
  ['Cinematic property edits designed to present listings with polish, pacing, and premium visual impact.', 'Real Estate Media', 'Karrar Enterprises'],
  ['Brand-led edits with clean graphics and storytelling made for consistent social publishing.', 'Social Media Content', 'Karrar Enterprises'],
  ['Luxury visuals, cinematic pacing, and premium sound design for elevated projects.', 'Yacht & Luxury Media', 'Karrar Enterprises'],
  ['Flexible creative support for projects that need a tailored editing approach.', 'Custom Projects', 'Karrar Enterprises']
];
let currentTestimonial = 0;
const stage = document.querySelector('#testimonialStage');
const dots = document.querySelector('#testimonialDots');
stage.innerHTML = testimonials.map(([quote, name, company], i) => `<article class="testimonial-card${i === 0 ? ' active' : ''}"><span class="quote-mark">“</span><blockquote>${quote}</blockquote><div class="testimonial-author"><strong>${name}</strong>${company ? `<span>${company}</span>` : ''}</div></article>`).join('');
dots.innerHTML = testimonials.map((_, i) => `<button aria-label="Show testimonial ${i + 1}" class="${i === 0 ? 'active' : ''}" data-index="${i}"></button>`).join('');
function showTestimonial(index) {
  currentTestimonial = (index + testimonials.length) % testimonials.length;
  document.querySelectorAll('.testimonial-card').forEach((card, i) => card.classList.toggle('active', i === currentTestimonial));
  dots.querySelectorAll('button').forEach((dot, i) => dot.classList.toggle('active', i === currentTestimonial));
}
document.querySelector('#prevTestimonial').addEventListener('click', () => showTestimonial(currentTestimonial - 1));
document.querySelector('#nextTestimonial').addEventListener('click', () => showTestimonial(currentTestimonial + 1));
dots.addEventListener('click', e => { if (e.target.dataset.index) showTestimonial(Number(e.target.dataset.index)); });
setInterval(() => showTestimonial(currentTestimonial + 1), 6500);

const header = document.querySelector('#header');
const menuToggle = document.querySelector('.menu-toggle');
menuToggle.addEventListener('click', () => { const open = header.classList.toggle('open'); menuToggle.setAttribute('aria-expanded', open); });
document.querySelectorAll('.mobile-menu a').forEach(link => link.addEventListener('click', () => { header.classList.remove('open'); menuToggle.setAttribute('aria-expanded', 'false'); }));
addEventListener('scroll', () => header.classList.toggle('scrolled', scrollY > 20), { passive: true });

document.addEventListener('click', e => {
  const select = e.target.closest('.package-select');
  if (select) { location.href = `/book-a-call/?service=${encodeURIComponent(select.dataset.service)}`; }
  const sound = e.target.closest('.sound-button');
  if (sound) { e.stopPropagation(); const video = sound.closest('.package-visual').querySelector('video'); if (!video) return; video.muted = !video.muted; sound.textContent = video.muted ? '⌁' : '♫'; sound.setAttribute('aria-label', video.muted ? 'Unmute preview' : 'Mute preview'); }
  const visual = e.target.closest('.package-visual');
  if (visual && !sound) { const video = visual.querySelector('video'); if (!video) return; video.paused ? video.play() : video.pause(); visual.querySelector('.play-icon').textContent = video.paused ? '▶' : 'Ⅱ'; }
});

let countersStarted = false;
const observer = new IntersectionObserver(entries => entries.forEach(entry => {
  if (!entry.isIntersecting) return;
  entry.target.classList.add('visible');
  if (entry.target.classList.contains('proof') && !countersStarted) {
    countersStarted = true;
    document.querySelectorAll('[data-target]').forEach(el => {
      const target = Number(el.dataset.target), duration = 1300, start = performance.now(), suffix = el.dataset.suffix || '+';
      function tick(now) { const p = Math.min((now - start) / duration, 1), value = Math.floor(target * (1 - Math.pow(1 - p, 3))); el.textContent = (target >= 1000 ? value.toLocaleString() : value) + suffix; if (p < 1) requestAnimationFrame(tick); }
      requestAnimationFrame(tick);
    });
  }
}), { threshold: .14 });
document.querySelectorAll('.reveal, .proof').forEach(el => observer.observe(el));
document.querySelectorAll('.hero .reveal').forEach(el => setTimeout(() => el.classList.add('visible'), 120));
