const editorPortal = window.KarrarPortal;
const assignmentsList = document.querySelector('#assignmentsList');
const editorCard = document.querySelector('#editorCard');
const linkDialog = document.querySelector('#linkDialog');
const linkInput = document.querySelector('#finalLinkInput');
const linkMessage = document.querySelector('#linkMessage');
const statusLabels = { submitted: 'Submitted', reviewing: 'Reviewing', awaiting_files: 'Awaiting Files', in_progress: 'In Progress', in_review: 'In Review', completed: 'Completed', cancelled: 'Cancelled' };
let assignments = [];
let editingId = null;

function escapeText(value = '') { const node = document.createElement('div'); node.textContent = value; return node.innerHTML; }
function serial(project) { return project.serial_number ? `#${String(project.serial_number).padStart(3, '0')}` : '—'; }
function formatLength(seconds) {
  const total = Number(seconds) || 0;
  if (!total) return '';
  if (total < 60) return `${total}s`;
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return rest ? `${minutes}m ${rest}s` : `${minutes} min`;
}
function safeHttpUrl(value) {
  if (!value) return '';
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
}
function detail(label, value, wide = false) { return `<div class="portal-detail-item${wide ? ' wide' : ''}"><small>${escapeText(label)}</small><strong>${escapeText(value || 'Not provided')}</strong></div>`; }
function linkDetail(label, value) {
  const url = safeHttpUrl(value);
  return `<div class="portal-detail-item wide"><small>${escapeText(label)}</small>${url ? `<a href="${url}" target="_blank" rel="noopener">Open saved link ↗</a><span>${escapeText(value)}</span>` : `<strong>${escapeText(value || 'Not provided')}</strong>`}</div>`;
}

// The editor sees the brief only — no client contact, pricing, or payment data.
function renderAssignments() {
  if (!assignments.length) {
    assignmentsList.innerHTML = '<div class="portal-empty">No projects are assigned to you yet.</div>';
    return;
  }
  assignmentsList.innerHTML = assignments.map(project => {
    const services = (project.services || []).map(service => `${service.name} × ${Number(service.quantity) || 0}`).join(', ') || project.service_name || 'Not provided';
    const finalUrl = safeHttpUrl(project.final_video_link);
    return `<article class="project-card">
      <div class="project-card-head">
        <div><span class="project-sequence">${escapeText(serial(project))}${project.service_name ? ` · ${escapeText(project.service_name)}` : ''}</span><h2>${escapeText(project.project_name)}</h2><time>Assigned · ${new Date(project.created_at).toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'})}</time></div>
        <div class="project-card-badges"><span class="status-badge">${statusLabels[project.status] || project.status}</span></div>
      </div>
      ${finalUrl ? `<div class="final-video-panel"><div><small>Delivered Final Video</small><a href="${finalUrl}" target="_blank" rel="noopener">${escapeText(project.final_video_link)}</a></div></div>` : ''}
      <div class="project-meta">
        <div><small>Format</small><strong>${escapeText(project.format || 'To be discussed')}</strong></div>
        <div><small>Aimed Length</small><strong>${escapeText(formatLength(project.aimed_length) || 'Not provided')}</strong></div>
        <div><small>Color Profile</small><strong>${escapeText(project.color_profile || 'Not provided')}</strong></div>
        <div><small>Music</small><strong>${escapeText(project.preferred_music || 'To be discussed')}</strong></div>
        <div><small>AI Add-On</small><strong>${project.ai_addon_scenes ? `${project.ai_addon_scenes} scene${project.ai_addon_scenes === 1 ? '' : 's'}` : 'Off'}</strong></div>
        <div><small>Service</small><strong>${escapeText(services)}</strong></div>
      </div>
      <div class="project-card-actions"><button class="button button-gold button-small" type="button" data-set-link="${project.id}">${finalUrl ? 'Update Final Video Link' : 'Add Final Video Link'}</button></div>
      <details class="client-project-details"><summary>View full brief <span>⌄</span></summary><div class="client-project-detail-body"><div class="portal-detail-grid">
        ${detail('Serial number', serial(project))}
        ${detail('Service', services)}
        ${detail('Format', project.format)}
        ${detail('Aimed length', formatLength(project.aimed_length))}
        ${detail('Color profile', project.color_profile)}
        ${detail('Preferred music', project.preferred_music)}
        ${detail('AI add-on', project.ai_addon_scenes ? `${project.ai_addon_scenes} scene${project.ai_addon_scenes === 1 ? '' : 's'}` : 'Off')}
        ${linkDetail('Footage / project files', project.footage_link)}
        ${linkDetail('Reference video', project.reference_link)}
        ${detail('Creative notes', project.creative_notes, true)}
      </div></div></details>
    </article>`;
  }).join('');
}

async function loadAssignments() {
  // Brief-only view: client contact, pricing and admin notes are never sent.
  const { data, error } = await editorPortal.client.from('editor_assignments').select('*').order('serial_number', { ascending: false });
  if (error) {
    assignmentsList.innerHTML = `<div class="portal-empty">${escapeText(error.message)}</div>`;
    return;
  }
  assignments = data || [];
  renderAssignments();
}

(async () => {
  const auth = await editorPortal.requireUser();
  if (!auth) return;
  const role = auth.profile?.role;
  if (role !== 'editor' && role !== 'admin') { location.replace('/profile/'); return; }
  const name = auth.profile?.full_name || auth.user.email?.split('@')[0] || 'Editor';
  editorCard.querySelector('.profile-avatar').textContent = name.charAt(0).toUpperCase();
  editorCard.querySelector('h2').textContent = name;
  editorCard.querySelector('p').textContent = auth.user.email;
  editorCard.querySelector('.role-badge').textContent = role === 'admin' ? 'Administrator' : 'Editor';
  await loadAssignments();
})();

assignmentsList.addEventListener('click', event => {
  const button = event.target.closest('[data-set-link]');
  if (!button) return;
  const project = assignments.find(item => item.id === button.dataset.setLink);
  if (!project) return;
  editingId = project.id;
  linkMessage.textContent = '';
  linkInput.value = project.final_video_link || '';
  linkDialog.querySelector('#linkTitle').textContent = `${serial(project)} · ${project.project_name}`;
  linkDialog.showModal();
});

document.querySelector('#saveFinalLink').addEventListener('click', async () => {
  if (!editingId) return;
  const value = linkInput.value.trim();
  if (value && !linkInput.checkValidity()) {
    linkMessage.textContent = 'Enter a valid link starting with https://';
    linkMessage.className = 'portal-message error';
    return;
  }
  linkMessage.textContent = 'Saving...';
  linkMessage.className = 'portal-message';
  const { error } = await editorPortal.client.from('projects').update({ final_video_link: value || null }).eq('id', editingId);
  if (error) {
    linkMessage.textContent = error.message;
    linkMessage.className = 'portal-message error';
    return;
  }
  linkDialog.close();
  editingId = null;
  await loadAssignments();
});

linkDialog.querySelectorAll('[data-close-link]').forEach(button => button.addEventListener('click', () => { linkDialog.close(); editingId = null; }));
document.querySelector('[data-signout]').addEventListener('click', () => editorPortal.signOut());
