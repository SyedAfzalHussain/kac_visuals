(() => {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Reveal is armed before anything is hidden, so a later error can never
  // leave the page stuck invisible.
  const reveal = () => document.documentElement.classList.add('page-ready');
  setTimeout(reveal, 1600);
  addEventListener('DOMContentLoaded', reveal);
  addEventListener('load', reveal);
  addEventListener('pageshow', reveal);

  const style = document.createElement('style');
  style.textContent = `
    #page-progress{position:fixed;inset:0 auto auto 0;height:2px;width:0;z-index:9999;pointer-events:none;
      background:linear-gradient(90deg,#9b8cff,#6354da);box-shadow:0 0 12px rgba(139,124,255,.65);
      opacity:0;transition:width .3s ease,opacity .3s ease}
    #page-progress.active{opacity:1}
    html:not(.page-ready) body{opacity:0}
    body{opacity:1;transition:opacity .34s ease}
    @media(prefers-reduced-motion:reduce){body{transition:none}html:not(.page-ready) body{opacity:1}}
  `;
  document.head.appendChild(style);

  const bar = document.createElement('div');
  bar.id = 'page-progress';
  addEventListener('DOMContentLoaded', () => document.body.appendChild(bar));

  let timer = null;
  function start() {
    if (reduceMotion || !bar.isConnected) return;
    clearInterval(timer);
    let width = 8;
    bar.classList.add('active');
    bar.style.width = '8%';
    timer = setInterval(() => {
      width = Math.min(width + (90 - width) * 0.12, 90);
      bar.style.width = `${width}%`;
    }, 220);
  }
  function done() {
    clearInterval(timer);
    bar.style.width = '100%';
    setTimeout(() => { bar.classList.remove('active'); bar.style.width = '0'; }, 320);
  }

  document.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link || event.defaultPrevented) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (link.target && link.target !== '_self') return;
    if (link.hasAttribute('download')) return;

    const href = link.getAttribute('href') || '';
    if (!href || href.startsWith('#') || /^(mailto:|tel:|javascript:)/i.test(href)) return;

    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin) return;
    if (url.pathname === location.pathname && url.search === location.search) return;

    start();
  });

  // Leaving via form submit or a scripted redirect should show progress too.
  addEventListener('beforeunload', start);
  addEventListener('pagehide', done);
})();
