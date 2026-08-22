const profilePortal = window.KarrarPortal;
const projectsList = document.querySelector('#projectsList');
const profileCard = document.querySelector('#profileCard');
const clientEditDialog = document.querySelector('#clientEditDialog');
const clientEditForm = document.querySelector('#clientEditForm');
const clientEditMessage = document.querySelector('#clientEditMessage');
const statusLabels = { submitted: 'Submitted', reviewing: 'Reviewing', awaiting_files: 'Awaiting Files', in_progress: 'In Progress', in_review: 'In Review', completed: 'Completed', cancelled: 'Cancelled' };
const paymentLabels = { unpaid: 'Unpaid', invoice_sent: 'Invoice Sent', partially_paid: 'Partially Paid', paid: 'Paid', refunded: 'Refunded' };
// Statuses a client may still edit. Once the admin moves a project to In Progress
// (and onward through In Review, Completed, Cancelled) it locks.
const editableStatuses = ['submitted', 'reviewing', 'awaiting_files'];
const fieldLabels = {
  project_name: 'Project name', status: 'Project status', payment_status: 'Payment status',
  final_video_link: 'Final video link', creative_notes: 'Creative notes and Script', admin_notes: 'Internal admin notes',
  format: 'Format', preferred_music: 'Preferred music', footage_link: 'Footage / project files',
  reference_link: 'Reference video', aimed_length: 'Aimed length', color_profile: 'Color profile',
  estimated_total: 'Estimated total', unit_price: 'Base price', phone: 'Phone / WhatsApp',
  company: 'Company', client_name: 'Client name', client_email: 'Client email',
  service_name: 'Service', ai_addon_scenes: 'AI add-on scenes'
};
const clientEditableFields = [
  { key: 'project_name', label: 'Project name', type: 'text', required: true },
  { key: 'phone', label: 'Phone / WhatsApp', type: 'text' },
  { key: 'company', label: 'Company', type: 'text' },
  { key: 'format', label: 'Format', type: 'text' },
  { key: 'aimed_length', label: 'Aimed length (seconds)', type: 'number' },
  { key: 'color_profile', label: 'Color profile', type: 'text' },
  { key: 'preferred_music', label: 'Preferred music', type: 'text' },
  { key: 'footage_link', label: 'Footage / project files', type: 'url', wide: true },
  { key: 'reference_link', label: 'Reference video', type: 'url', wide: true },
  { key: 'creative_notes', label: 'Creative notes and Script', type: 'textarea', wide: true, required: true }
];
let myProjects = [];
let editsByProject = new Map();
let editingId = null;

function escapeText(value = '') { const node = document.createElement('div'); node.textContent = value; return node.innerHTML; }
function money(value) { return `$${Number(value || 0).toFixed(0)}`; }
function dateTime(value) { return value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Not provided'; }
function serial(project) { return project.serial_number ? `#${String(project.serial_number).padStart(3, '0')}` : '—'; }
function safeHttpUrl(value) {
  if (!value) return '';
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
}
function detail(label, value, wide = false, copyable = false) { return `<div class="portal-detail-item${wide ? ' wide' : ''}"><small>${escapeText(label)}</small><strong>${escapeText(value || 'Not provided')}</strong>${copyable ? profilePortal.copyButton(value) : ''}</div>`; }
// The final video is held between the team and released deliberately, so an
// empty value here means "not delivered yet", not "missing".
function finalLinkDetail(project) {
  if (safeHttpUrl(project.final_video_link)) return linkDetail('Final video link', project.final_video_link);
  return `<div class="portal-detail-item wide"><small>Final video link</small><strong>Your final video will appear here once it has been delivered.</strong></div>`;
}
function linkDetail(label, value) {
  const url = safeHttpUrl(value);
  return `<div class="portal-detail-item wide"><small>${escapeText(label)}</small>${url ? `<a href="${url}" target="_blank" rel="noopener">Open saved link ↗</a><span>${escapeText(value)}</span>` : `<strong>${escapeText(value || 'Not provided')}</strong>`}${profilePortal.copyButton(value)}</div>`;
}
function historyValue(field, value) {
  if (value === null || value === '') return 'Empty';
  if (field === 'status') return statusLabels[value] || value;
  if (field === 'payment_status') return paymentLabels[value] || value;
  return value;
}

function renderHistory(edits) {
  if (!edits?.length) return '<p class="history-empty">No changes yet — this is your original submission.</p>';
  return edits.map(edit => `<div class="history-entry">
    <div class="history-head"><strong>${escapeText(fieldLabels[edit.field] || edit.field)}</strong><span>${escapeText(dateTime(edit.created_at))} · ${escapeText(edit.edited_by_role === 'admin' ? 'Karrar Enterprises' : (edit.edited_by_name || 'You'))}</span></div>
    <div class="history-values">
      <div class="history-old"><small>Before</small><span>${escapeText(historyValue(edit.field, edit.old_value))}</span></div>
      <div class="history-new"><small>After</small><span>${escapeText(historyValue(edit.field, edit.new_value))}</span></div>
    </div>
  </div>`).join('');
}

function renderProjects(projects) {
  if (!projects.length) { projectsList.innerHTML = '<div class="portal-empty">No projects yet. Start your first project when you’re ready.</div>'; return; }
  projectsList.innerHTML = projects.map(project => {
    const payment = project.payment_status || 'unpaid';
    const services = (project.services || []).map(service => `${service.name} × ${Number(service.quantity) || 0}`).join(', ') || project.service_name || 'Not provided';
    const editable = editableStatuses.includes(project.status);
    const finalUrl = safeHttpUrl(project.final_video_link);
    const edits = editsByProject.get(project.id) || [];
    return `<article class="project-card">
      <div class="project-card-head"><div><span class="project-sequence">${escapeText(serial(project))}${project.service_name ? ` · Video ${String(project.project_number || 1).padStart(2, '0')} · ${escapeText(project.service_name)}` : ''}</span><h2>${escapeText(project.project_name)}</h2><time>${new Date(project.created_at).toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'})}</time></div><div class="project-card-badges"><span class="status-badge">${statusLabels[project.status] || project.status}</span><span class="payment-badge" data-payment="${payment}">Payment · ${paymentLabels[payment] || payment}</span></div></div>
      ${finalUrl ? `<div class="final-video-panel"><div><small>Your Final Video</small><a href="${finalUrl}" target="_blank" rel="noopener">Watch / download your video ↗</a></div>${profilePortal.copyButton(project.final_video_link)}</div>` : ''}
      <div class="project-services">${(project.services || []).map(service => `<span>${escapeText(service.name)} × ${Number(service.quantity) || 0}</span>`).join('')}</div>
      <div class="project-meta"><div><small>Format</small><strong>${escapeText(project.format || 'To be discussed')}</strong></div><div><small>Aimed Length</small><strong>${project.aimed_length ? `${project.aimed_length}s` : 'Not provided'}</strong></div><div><small>Color Profile</small><strong>${escapeText(project.color_profile || 'Not provided')}</strong></div><div><small>Music</small><strong>${escapeText(project.preferred_music || 'To be discussed')}</strong></div><div><small>AI Add-On</small><strong>${project.ai_addon_scenes ? `${project.ai_addon_scenes} scene${project.ai_addon_scenes === 1 ? '' : 's'} · ${money(project.ai_addon_price)}` : 'Off'}</strong></div><div><small>Estimate</small><strong>${money(project.estimated_total)}</strong></div></div>
      <div class="project-card-actions">${editable ? `<button class="button button-outline button-small" type="button" data-edit-project="${project.id}" style="color: #8b7cff;" >Edit Project</button>` : '<span class="locked-note">This project is in production and can no longer be edited. Contact us for changes.</span>'}${edits.length ? `<span class="edited-badge">Edited · ${edits.length} change${edits.length === 1 ? '' : 's'}</span>` : ''}</div>
      <details class="client-project-details"><summary>View complete project details <span>⌄</span></summary><div class="client-project-detail-body"><div class="portal-detail-grid">${detail('Serial number', serial(project))}${detail('Service', services)}${detail('Phone / WhatsApp', project.phone)}${detail('Company', project.company)}${detail('Project status', statusLabels[project.status] || project.status)}${detail('Payment status', paymentLabels[payment] || payment)}${detail('Format', project.format)}${detail('Aimed length', project.aimed_length ? `${project.aimed_length}s` : '')}${detail('Color profile', project.color_profile)}${detail('Preferred music', project.preferred_music)}${detail('AI add-on', project.ai_addon_scenes ? `${project.ai_addon_scenes} scene${project.ai_addon_scenes === 1 ? '' : 's'} · ${money(project.ai_addon_price)}` : 'Off')}${finalLinkDetail(project)}${linkDetail('Footage / project files', project.footage_link)}${linkDetail('Reference video', project.reference_link)}${detail('Creative notes and Script', project.creative_notes, true, true)}${detail('Submitted', new Date(project.created_at).toLocaleString(), true)}${detail('Submission ID', project.submission_id, true)}${detail('Project ID', project.id, true)}</div><h3 class="history-title">Edit History</h3><div class="history-list">${renderHistory(edits)}</div></div></details>
    </article>`;
  }).join('');
}

function openEditor(project) {
  editingId = project.id;
  clientEditMessage.textContent = '';
  clientEditDialog.querySelector('#clientEditTitle').textContent = `${serial(project)} · ${project.project_name}`;
  clientEditForm.innerHTML = clientEditableFields.map(field => {
    const value = project[field.key] ?? '';
    if (field.type === 'textarea') {
      return `<label class="portal-field wide"><span>${escapeText(field.label)}</span><textarea rows="4" data-field="${field.key}">${escapeText(value)}</textarea></label>`;
    }
    return `<label class="portal-field${field.wide ? ' wide' : ''}"><span>${escapeText(field.label)}</span><input type="${field.type}" data-field="${field.key}" value="${escapeText(value)}"></label>`;
  }).join('');
  clientEditDialog.showModal();
}

async function loadProjects() {
  const [projectsResult, editsResult] = await Promise.all([
    // View, not the table: keeps internal admin notes out of the payload.
    profilePortal.client.from('my_projects').select('*').order('serial_number', { ascending: false }),
    profilePortal.client.from('project_edits').select('*').order('created_at', { ascending: false })
  ]);
  if (projectsResult.error) {
    projectsList.innerHTML = `<div class="portal-empty">${escapeText(projectsResult.error.message)}</div>`;
    return;
  }
  myProjects = projectsResult.data || [];
  editsByProject = new Map();
  (editsResult.data || []).forEach(edit => {
    if (!editsByProject.has(edit.project_id)) editsByProject.set(edit.project_id, []);
    editsByProject.get(edit.project_id).push(edit);
  });
  renderProjects(myProjects);
}

(async () => {
  const auth = await profilePortal.requireUser();
  if (!auth) return;
  if (auth.profile?.role === 'editor') { location.replace('/editor/'); return; }
  profilePortal.releaseGate();
  const name = auth.profile?.full_name || auth.user.user_metadata?.full_name || 'Client';
  profileCard.querySelector('.profile-avatar').textContent = name.charAt(0).toUpperCase();
  profileCard.querySelector('h2').textContent = name;
  profileCard.querySelector('p').textContent = auth.user.email;
  const roleLabels = { admin: 'Administrator', editor: 'Editor', client: 'Client' };
  const badge = profileCard.querySelector('.role-badge');
  badge.textContent = roleLabels[auth.profile?.role] || 'Client';
  badge.dataset.role = auth.profile?.role || 'client';
  if (auth.profile?.role === 'admin') {
    const link = document.createElement('a'); link.className = 'button button-outline button-small'; link.href = '/admin/'; link.textContent = 'Admin Dashboard'; link.style.marginTop = '20px'; profileCard.appendChild(link);
  }
  await loadProjects();
})();

projectsList.addEventListener('click', event => {
  const button = event.target.closest('[data-edit-project]');
  if (!button) return;
  const project = myProjects.find(item => item.id === button.dataset.editProject);
  if (project) openEditor(project);
});

document.querySelector('#saveClientEdit').addEventListener('click', async () => {
  if (!editingId) return;
  const payload = {};
  const missing = [];
  clientEditForm.querySelectorAll('[data-field]').forEach(input => {
    const field = clientEditableFields.find(item => item.key === input.dataset.field);
    const raw = input.value.trim();
    if (raw === '' && field.required) { missing.push(field.label); return; }
    payload[input.dataset.field] = raw === '' ? null : (field.type === 'number' ? Number(raw) : raw);
  });
  if (missing.length) {
    clientEditMessage.textContent = `Required field${missing.length === 1 ? '' : 's'} cannot be empty: ${missing.join(', ')}.`;
    clientEditMessage.className = 'portal-message error';
    return;
  }
  clientEditMessage.textContent = 'Saving...';
  clientEditMessage.className = 'portal-message';
  const { error } = await profilePortal.client.from('projects').update(payload).eq('id', editingId);
  if (error) {
    clientEditMessage.textContent = error.message;
    clientEditMessage.className = 'portal-message error';
    return;
  }
  clientEditDialog.close();
  editingId = null;
  await loadProjects();
});

clientEditDialog.querySelectorAll('[data-close-client-edit]').forEach(button => button.addEventListener('click', () => { clientEditDialog.close(); editingId = null; }));
document.querySelector('[data-signout]').addEventListener('click', () => profilePortal.signOut());
