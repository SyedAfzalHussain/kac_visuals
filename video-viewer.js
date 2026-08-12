(() => {
  const viewer = document.createElement('div');
  viewer.className = 'video-viewer';
  viewer.hidden = true;
  viewer.setAttribute('role', 'dialog');
  viewer.setAttribute('aria-modal', 'true');
  viewer.setAttribute('aria-label', 'Video player');
  viewer.innerHTML = `<p class="video-viewer__title"></p><button class="video-viewer__close" type="button" aria-label="Close video">×</button><div class="video-viewer__stage"><video class="video-viewer__video" controls playsinline preload="metadata"></video></div>`;
  document.body.appendChild(viewer);

  const video = viewer.querySelector('video');
  const stage = viewer.querySelector('.video-viewer__stage');
  const title = viewer.querySelector('.video-viewer__title');
  const closeButton = viewer.querySelector('.video-viewer__close');
  let returnFocus = null;

  function close() {
    if (viewer.hidden) return;
    video.pause();
    video.removeAttribute('src');
    video.load();
    viewer.hidden = true;
    document.body.classList.remove('video-viewer-open');
    returnFocus?.focus?.();
  }

  function open(src, label, trigger) {
    if (!src) return;
    returnFocus = trigger || document.activeElement;
    title.textContent = label || 'Video preview';
    video.src = src;
    video.style.width = '0';
    video.style.height = '0';
    video.muted = false;
    viewer.hidden = false;
    document.body.classList.add('video-viewer-open');
    closeButton.focus();
    video.play().catch(() => {});
  }

  function fitVideo() {
    if (!video.videoWidth || !video.videoHeight || viewer.hidden) return;
    const bounds = stage.getBoundingClientRect();
    const ratio = video.videoWidth / video.videoHeight;
    const width = Math.min(bounds.width, bounds.height * ratio);
    video.style.width = `${Math.floor(width)}px`;
    video.style.height = `${Math.floor(width / ratio)}px`;
  }

  video.addEventListener('loadedmetadata', () => requestAnimationFrame(fitVideo));
  window.addEventListener('resize', fitVideo);

  closeButton.addEventListener('click', close);
  viewer.addEventListener('click', event => { if (event.target === viewer) close(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !viewer.hidden) close(); });
  window.KarrarVideoViewer = { open, close };
})();
