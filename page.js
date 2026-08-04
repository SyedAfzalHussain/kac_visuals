const header = document.querySelector('#header');
const toggle = document.querySelector('.menu-toggle');
if (header && toggle) {
  toggle.addEventListener('click', () => {
    const open = header.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  document.querySelectorAll('.mobile-menu a').forEach(link => link.addEventListener('click', () => {
    header.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  }));
  addEventListener('scroll', () => header.classList.toggle('scrolled', scrollY > 20), { passive: true });
}

const revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
  if (!entry.isIntersecting) return;
  entry.target.classList.add('visible');
  if (entry.target.classList.contains('page-metrics') && !entry.target.dataset.started) {
    entry.target.dataset.started = 'true';
    entry.target.querySelectorAll('[data-target]').forEach(el => {
      const target = Number(el.dataset.target), suffix = el.dataset.suffix || '+', start = performance.now();
      const tick = now => {
        const p = Math.min((now - start) / 1300, 1);
        const n = Math.floor(target * (1 - Math.pow(1 - p, 3)));
        el.textContent = (target >= 1000 ? n.toLocaleString() : n) + suffix;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }
}), { threshold: .12 });
document.querySelectorAll('.reveal, .page-metrics').forEach(el => revealObserver.observe(el));
setTimeout(() => document.querySelectorAll('.page-hero .reveal').forEach(el => el.classList.add('visible')), 80);

document.querySelectorAll('.tier-button').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.tier-card').forEach(card => card.classList.remove('chosen'));
  button.closest('.tier-card').classList.add('chosen');
  document.querySelectorAll('.tier-button').forEach(item => item.textContent = item.dataset.label);
  button.textContent = 'Selected';
}));
