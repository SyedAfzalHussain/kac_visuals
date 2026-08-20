(() => {
  const form = document.querySelector('#customForm');
  if (!form) return;

  const steps = form.querySelectorAll('.custom-fieldset');
  const markers = document.querySelectorAll('#customSteps .custom-step');
  const backButton = form.querySelector('#customBack');
  const nextButton = form.querySelector('#customNext');
  const errorBox = form.querySelector('#customError');
  const successBox = form.querySelector('#customSuccess');
  const controls = form.querySelector('#customControls');
  let current = 1;
  let submitting = false;

  function showStep(step) {
    current = step;
    steps.forEach(fieldset => { fieldset.hidden = Number(fieldset.dataset.step) !== step; });
    markers.forEach(marker => marker.classList.toggle('active', Number(marker.dataset.stepMarker) <= step));
    backButton.hidden = step === 1;
    nextButton.textContent = step === steps.length ? 'Submit Request' : 'Continue →';
    errorBox.textContent = '';
  }

  function validateStep1() {
    const name = form.querySelector('#customName').value.trim();
    const email = form.querySelector('#customEmail').value.trim();
    const phone = form.querySelector('#customPhone').value.trim();
    if (!name || !email) return 'Name and email are required';
    if (!/^\S+@\S+\.\S+$/.test(email)) return 'Please enter a valid email address.';
    if (!phone) return 'Phone is required so we can reach you about your quote.';
    return '';
  }

  function validateStep2() {
    const projectName = form.querySelector('#customProjectName').value.trim();
    const details = form.querySelector('#customDetails').value.trim();
    if (!projectName || !details) return 'Project name and description are required';
    return '';
  }

  async function submitRequest() {
    const name = form.querySelector('#customName').value.trim();
    const email = form.querySelector('#customEmail').value.trim();
    const phone = form.querySelector('#customPhone').value.trim();
    const company = form.querySelector('#customCompany').value.trim();
    const projectName = form.querySelector('#customProjectName').value.trim();
    const details = form.querySelector('#customDetails').value.trim();
    const videoCount = form.querySelector('#customVideoCount').value.trim();
    const reference = form.querySelector('#customReference').value.trim();
    const filesLink = form.querySelector('#customFilesLink').value.trim();
    const comments = form.querySelector('#customComments').value.trim();

    const notes = [
      details,
      videoCount && `Number of videos: ${videoCount}`,
      comments && `Anything else: ${comments}`
    ].filter(Boolean).join('\n\n');

    const client = window.KarrarPortal?.client;
    if (!client) throw new Error('Submission is unavailable right now. Please email karrarvisuals@gmail.com directly.');

    const { error } = await client.from('projects').insert([{
      client_name: name,
      client_email: email,
      phone,
      company: company || null,
      project_name: projectName,
      service_name: 'Custom Quote Request',
      creative_notes: notes,
      footage_link: filesLink || null,
      reference_link: reference || null,
      // Required by the projects table's row-level security check; not a meaningful field for custom quotes.
      aimed_length: 60
    }]);
    if (error) throw new Error(error.message || 'Submission failed. Please try again.');
  }

  nextButton.addEventListener('click', async () => {
    if (submitting) return;
    const error = current === 1 ? validateStep1() : validateStep2();
    if (error) { errorBox.textContent = error; return; }

    if (current < steps.length) { showStep(current + 1); return; }

    submitting = true;
    errorBox.textContent = '';
    nextButton.disabled = true;
    nextButton.textContent = 'Submitting...';
    try {
      await submitRequest();
      steps.forEach(fieldset => fieldset.hidden = true);
      controls.hidden = true;
      successBox.hidden = false;
    } catch (err) {
      errorBox.textContent = err.message || 'Submission failed. Please try again.';
      nextButton.disabled = false;
      nextButton.textContent = 'Submit Request';
    } finally {
      submitting = false;
    }
  });

  backButton.addEventListener('click', () => showStep(current - 1));

  showStep(1);
})();
