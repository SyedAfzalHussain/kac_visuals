const packages = [
  ['Viral Cut', '$279', ['15–75 sec', 'Fast, trend-driven', 'Reels, TikTok, Shorts'], 'viral_cut.mp4'],
  ['Branding Cut', '$189', ['15–40 sec', 'Text-driven, structured', 'Authority & reach'], 'branding_cut.mp4'],
  ['Groovy Cut', '$279', ['15–75 sec', 'Creative, rhythmic', 'Standout social posts'], 'groovy_cut.mp4'],
  ['Cinematic Cut', '$279', ['20 sec – 2 min', 'Elegant, cinematic', 'MLS & flagship listings'], 'cinematic_cut.mp4'],
  ['Value Cut', '$149', ['Walk-through', 'Clean, ambient', '2-day delivery'], 'value_cut.mp4']
];
const cdn = 'https://pub-e3f8646261174eaf9641d7f4dc9db812.r2.dev/demo-videos/';
const packageGrid = document.querySelector('#packageGrid');
packageGrid.innerHTML = packages.map(([name, price, features, file], index) => `
  <article class="package-card reveal">
    <div class="package-visual" tabindex="0" role="button" aria-label="Play ${name} preview">
      <video src="${cdn + file}" autoplay muted loop playsinline preload="metadata"></video>
      <div class="package-overlay"></div><span class="play-icon">▶</span>
      <div class="package-info"><h3>${name}</h3><p class="package-price">${price}</p><ul>${features.map(f => `<li>${f}</li>`).join('')}</ul></div>
      <button class="sound-button" type="button" aria-label="Unmute preview">⌁</button>
    </div>
    <button class="package-select" type="button">Select</button>
  </article>`).join('');

const logos = ['CohenCo_White.png','KNOWN-WHITE-768x884.png','Studio-910.png','Studio-Sunday-768x573.png','JT_visuals-768x360.png','Akbar.png','RESONATE_white-768x169.png','Eric-Visuals.png'];
const logoTrack = document.querySelector('#logoTrack');
logoTrack.innerHTML = [...logos, ...logos].map(name => `<img src="assets/logos/${name}" alt="Client logo" />`).join('');

const testimonials = [
  ['Cliffside created a style that many try to imitate, but none can match. Truly the best in the business.', 'Mikołaj Kantor', 'Resonate Media'],
  ['The solution we all needed.', 'Claudio Rivera', 'Studio 910'],
  ['The difference between Cliffside Cuts and other editing agencies is their relentless pursuit of improvement. They are built, trained, and operated by one of the best editors in the industry. No other agency has that.', 'JT Visuals', ''],
  ["Cliffside Cuts has been nothing short of excellent. The video editing quality is superior to anyone else I've worked with, and I exclusively use them for all of my videos. Their website is extremely easy to use, and communicating with the editors for revisions or feedback is simple and seamless. Since I started working with them, the entire process has been amazing, and I plan to continue using them. They're awesome!", 'Chris Glenn', '']
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
  if (select) { document.querySelectorAll('.package-card').forEach(card => card.classList.remove('selected')); select.closest('.package-card').classList.add('selected'); select.textContent = 'Selected'; }
  const sound = e.target.closest('.sound-button');
  if (sound) { e.stopPropagation(); const video = sound.closest('.package-visual').querySelector('video'); video.muted = !video.muted; sound.textContent = video.muted ? '⌁' : '♫'; sound.setAttribute('aria-label', video.muted ? 'Unmute preview' : 'Mute preview'); }
  const visual = e.target.closest('.package-visual');
  if (visual && !sound) { const video = visual.querySelector('video'); video.paused ? video.play() : video.pause(); visual.querySelector('.play-icon').textContent = video.paused ? '▶' : 'Ⅱ'; }
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
