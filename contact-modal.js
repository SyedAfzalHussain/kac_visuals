(() => {
  let modal = document.querySelector('#contactDetailsModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.className = 'contact-modal';
    modal.id = 'contactDetailsModal';
    modal.hidden = true;
    modal.innerHTML = `<div class="contact-modal__backdrop" data-close-contact></div>
      <section class="contact-modal__card" role="dialog" aria-modal="true" aria-labelledby="contactDetailsTitle">
        <button class="contact-modal__close" type="button" aria-label="Close contact details" data-close-contact>×</button>
        <img src="/assets/karrar/logo.png" alt="Karrar Enterprises">
        <p class="kicker">Contact</p>
        <h2 id="contactDetailsTitle">Syed Suhail Karar</h2>
        <p>Choose the easiest way to discuss your project.</p>
        <div class="contact-modal__actions">
          <a class="button button-gold" href="tel:+14028087996">Call +1 402 808 7996</a>
          <a class="button button-outline" href="https://wa.me/923499535028" target="_blank" rel="noopener">WhatsApp</a>
          <a class="button button-outline" href="mailto:karrarvisuals@gmail.com">Email</a>
        </div>
        <address>5830 E 2nd St, Ste 7000<br>Casper, WY 82609, United States</address>
      </section>`;
    document.body.appendChild(modal);
  }

  let returnFocus = null;
  function open(trigger) {
    returnFocus = trigger;
    modal.hidden = false;
    document.body.classList.add('contact-modal-open');
    document.querySelector('#header')?.classList.remove('open');
    modal.querySelector('.contact-modal__close').focus();
  }
  function close() {
    modal.hidden = true;
    document.body.classList.remove('contact-modal-open');
    returnFocus?.focus?.();
  }

  document.addEventListener('click', event => {
    const trigger = event.target.closest('[data-contact-modal], #contactDetailsButton');
    if (trigger) { event.preventDefault(); open(trigger); return; }
    if (event.target.closest('[data-close-contact]')) close();
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !modal.hidden) close(); });
})();
