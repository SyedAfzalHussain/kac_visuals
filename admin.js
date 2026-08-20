const adminPortal = window.KarrarPortal;
const tbody = document.querySelector('#adminProjects');
const search = document.querySelector('#projectSearch');
const filter = document.querySelector('#statusFilter');
const clientFilter = document.querySelector('#clientFilter');
const paymentFilter = document.querySelector('#paymentFilter');
const adminMessage = document.querySelector('#adminMessage');
const detailsDialog = document.querySelector('#projectDetailsDialog');
const detailsContent = document.querySelector('#adminProjectDetails');
const editDialog = document.querySelector('#projectEditDialog');
const editForm = document.querySelector('#projectEditForm');
const editMessage = document.querySelector('#editMessage');
const deleteDialog = document.querySelector('#deleteConfirmDialog');
const deleteMessage = document.querySelector('#deleteMessage');
const statuses = [['submitted','Submitted'],['reviewing','Reviewing'],['awaiting_files','Awaiting Files'],['in_progress','In Progress'],['in_review','In Review'],['completed','Completed'],['cancelled','Cancelled']];
const paymentStatuses = [['unpaid','Unpaid'],['invoice_sent','Invoice Sent'],['partially_paid','Partially Paid'],['paid','Paid'],['refunded','Refunded']];
const fieldLabels = {
  project_name: 'Project name', status: 'Project status', payment_status: 'Payment status',
  final_video_link: 'Final video link', creative_notes: 'Creative notes', admin_notes: 'Internal admin notes',
  format: 'Format', preferred_music: 'Preferred music', footage_link: 'Footage / project files',
  reference_link: 'Reference video', aimed_length: 'Aimed length', color_profile: 'Color profile',
  estimated_total: 'Estimated total', unit_price: 'Base price', phone: 'Phone / WhatsApp',
  company: 'Company', client_name: 'Client name', client_email: 'Client email',
  service_name: 'Service', ai_addon_scenes: 'AI add-on scenes'
};
const editableFields = [
  { key: 'project_name', label: 'Project name', type: 'text', required: true },
  { key: 'client_name', label: 'Client name', type: 'text', required: true },
  { key: 'client_email', label: 'Client email', type: 'email', required: true },
  { key: 'phone', label: 'Phone / WhatsApp', type: 'text' },
  { key: 'company', label: 'Company', type: 'text' },
  { key: 'status', label: 'Project status', type: 'select', options: statuses },
  { key: 'payment_status', label: 'Payment status', type: 'select', options: paymentStatuses },
  { key: 'final_video_link', label: 'Final video link (shown to client)', type: 'url', wide: true },
  { key: 'format', label: 'Format', type: 'text' },
  { key: 'aimed_length', label: 'Aimed length (seconds)', type: 'number' },
  { key: 'color_profile', label: 'Color profile', type: 'text' },
  { key: 'preferred_music', label: 'Preferred music', type: 'text' },
  { key: 'estimated_total', label: 'Estimated total ($)', type: 'number' },
  { key: 'footage_link', label: 'Footage / project files', type: 'url', wide: true },
  { key: 'reference_link', label: 'Reference video', type: 'url', wide: true },
  { key: 'creative_notes', label: 'Creative notes', type: 'textarea', wide: true, required: true },
  { key: 'admin_notes', label: 'Internal admin notes', type: 'textarea', wide: true }
];
let allProjects = [];
let editsByProject = new Map();
let editingId = null;
let deletingId = null;

function escapeText(value = '') { const node = document.createElement('div'); node.textContent = value; return node.innerHTML; }
function labelFor(options, value) { return options.find(([key]) => key === value)?.[1] || value || 'Not provided'; }
function money(value) { return `$${Number(value || 0).toFixed(0)}`; }
function dateTime(value) { return value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Not provided'; }
function serial(project) { return project.serial_number ? `#${String(project.serial_number).padStart(3, '0')}` : '—'; }
function safeHttpUrl(value) {
  if (!value) return '';
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
}
function detail(label, value, wide = false) { return `<div class="portal-detail-item${wide ? ' wide' : ''}"><small>${escapeText(label)}</small><strong>${escapeText(value || 'Not provided')}</strong></div>`; }
function linkDetail(label, value) {
  const url = safeHttpUrl(value);
  return `<div class="portal-detail-item wide"><small>${escapeText(label)}</small>${url ? `<a href="${url}" target="_blank" rel="noopener">Open saved link ↗</a><span>${escapeText(value)}</span>` : `<strong>${escapeText(value || 'Not provided')}</strong>`}</div>`;
}
function historyValue(field, value) {
  if (value === null || value === '') return 'Empty';
  if (field === 'status') return labelFor(statuses, value);
  if (field === 'payment_status') return labelFor(paymentStatuses, value);
  return value;
}

function renderHistory(edits) {
  if (!edits?.length) return '<p class="history-empty">No edits yet — this is the original submission.</p>';
  return edits.map(edit => `<div class="history-entry">
    <div class="history-head"><strong>${escapeText(fieldLabels[edit.field] || edit.field)}</strong><span>${escapeText(dateTime(edit.created_at))} · ${escapeText(edit.edited_by_name || 'Unknown user')}${edit.edited_by_role ? ` · ${escapeText(edit.edited_by_role)}` : ''}</span></div>
    <div class="history-values">
      <div class="history-old"><small>Before</small><span>${escapeText(historyValue(edit.field, edit.old_value))}</span></div>
      <div class="history-new"><small>After</small><span>${escapeText(historyValue(edit.field, edit.new_value))}</span></div>
    </div>
  </div>`).join('');
}

function populateClientFilter() {
  const seen = new Map();
  allProjects.forEach(project => {
    const key = project.client_email || project.client_name;
    if (key && !seen.has(key)) seen.set(key, `${project.client_name || 'Unknown'} · ${project.client_email || ''}`.trim());
  });
  const previous = clientFilter.value;
  clientFilter.innerHTML = '<option value="">All clients</option>' + [...seen].map(([value, label]) => `<option value="${escapeText(value)}">${escapeText(label)}</option>`).join('');
  clientFilter.value = previous;
}

function render() {
  const query = search.value.toLowerCase().trim();
  const status = filter.value;
  const client = clientFilter.value;
  const payment = paymentFilter.value;
  const projects = allProjects.filter(project =>
    (!status || project.status === status)
    && (!payment || (project.payment_status || 'unpaid') === payment)
    && (!client || (project.client_email || project.client_name) === client)
    && (!query || [project.project_name,project.client_name,project.client_email,project.company,project.phone,project.submission_id,serial(project)].some(value => String(value || '').toLowerCase().includes(query))));
  tbody.innerHTML = projects.length ? projects.map(project => {
    const editCount = editsByProject.get(project.id)?.length || 0;
    return `<tr>
    <td><strong class="serial-cell">${escapeText(serial(project))}</strong></td>
    <td><strong>${project.service_name ? `Video ${String(project.project_number || 1).padStart(2, '0')} · ` : ''}${escapeText(project.project_name)}</strong><span>${escapeText(project.format || '')}${project.aimed_length ? ` · ${project.aimed_length}s` : ''}${project.color_profile ? ` · ${escapeText(project.color_profile)}` : ''}</span>${editCount ? `<span class="edited-badge">Edited · ${editCount} change${editCount === 1 ? '' : 's'}</span>` : ''}<button class="admin-view-button" type="button" data-view-project="${project.id}">View all details</button></td>
    <td><strong>${escapeText(project.client_name)}${project.client_id ? '' : ' · Guest'}</strong><span>${escapeText(project.client_email)}${project.company ? ` · ${escapeText(project.company)}` : ''}</span></td>
    <td>${(project.services || []).map(service => `${escapeText(service.name)} × ${service.quantity}`).join('<br>')}${project.ai_addon_scenes ? `<br><span>AI: ${project.ai_addon_scenes} scene${project.ai_addon_scenes === 1 ? '' : 's'} (+${money(project.ai_addon_price)})</span>` : ''}</td>
    <td>${money(project.estimated_total)}</td><td>${new Date(project.created_at).toLocaleDateString()}</td>
    <td><select data-project-status="${project.id}">${statuses.map(([value,label]) => `<option value="${value}"${project.status === value ? ' selected' : ''}>${label}</option>`).join('')}</select></td>
    <td><select data-payment-status="${project.id}">${paymentStatuses.map(([value,label]) => `<option value="${value}"${(project.payment_status || 'unpaid') === value ? ' selected' : ''}>${label}</option>`).join('')}</select></td>
    <td><div class="row-actions"><button class="admin-row-button" type="button" data-edit-project="${project.id}">Edit</button><button class="admin-row-button danger" type="button" data-delete-project="${project.id}">Delete</button></div></td>
  </tr>`; }).join('') : '<tr><td colspan="9">No projects found.</td></tr>';
}

function openProjectDetails(project) {
  const services = (project.services || []).map(service => `${service.name} × ${service.quantity}`).join(', ') || project.service_name || 'Not provided';
  const phoneHref = String(project.phone || '').replace(/[^0-9+]/g, '');
  detailsContent.innerHTML = `<header class="portal-detail-heading"><p class="kicker">Complete Saved Request · ${escapeText(serial(project))}</p><h2 id="projectDetailsTitle">${escapeText(project.project_name)}</h2><div class="project-card-badges"><span class="status-badge">${escapeText(labelFor(statuses, project.status))}</span><span class="payment-badge" data-payment="${project.payment_status || 'unpaid'}">Payment · ${escapeText(labelFor(paymentStatuses, project.payment_status || 'unpaid'))}</span></div></header>
    <section class="portal-detail-section"><h3>Client Contact</h3><div class="portal-detail-grid">${detail('Full name', project.client_name)}<div class="portal-detail-item"><small>Email</small><a href="mailto:${encodeURIComponent(project.client_email || '')}">${escapeText(project.client_email)}</a></div><div class="portal-detail-item"><small>Phone / WhatsApp</small>${phoneHref ? `<a href="tel:${phoneHref}">${escapeText(project.phone)}</a>` : '<strong>Not provided</strong>'}</div>${detail('Company', project.company)}${detail('Account type', project.client_id ? 'Registered client' : 'Guest')}</div></section>
    <section class="portal-detail-section"><h3>Project Brief</h3><div class="portal-detail-grid">${detail('Serial number', serial(project))}${detail('Service', services)}${detail('Video number', String(project.project_number || 1).padStart(2, '0'))}${detail('Format', project.format)}${detail('Aimed length', project.aimed_length ? `${project.aimed_length}s` : '')}${detail('Color profile', project.color_profile)}${detail('Preferred music', project.preferred_music)}${detail('AI add-on', project.ai_addon_scenes ? `${project.ai_addon_scenes} scene${project.ai_addon_scenes === 1 ? '' : 's'} · ${money(project.ai_addon_price)}` : 'Off')}${linkDetail('Final video link', project.final_video_link)}${linkDetail('Footage / project files', project.footage_link)}${linkDetail('Reference video', project.reference_link)}${detail('Creative notes', project.creative_notes, true)}${detail('Internal admin notes', project.admin_notes, true)}</div></section>
    <section class="portal-detail-section"><h3>Pricing &amp; Record</h3><div class="portal-detail-grid">${detail('Base price', money(project.unit_price || Number(project.estimated_total) - Number(project.ai_addon_price || 0)))}${detail('AI add-on price', money(project.ai_addon_price))}${detail('Estimated total', money(project.estimated_total))}${detail('Payment status', labelFor(paymentStatuses, project.payment_status || 'unpaid'))}${detail('Project status', labelFor(statuses, project.status))}${detail('Submitted', dateTime(project.created_at))}${detail('Last updated', dateTime(project.updated_at))}${detail('Submission ID', project.submission_id, true)}${detail('Project ID', project.id, true)}</div></section>
    <section class="portal-detail-section"><h3>Edit History</h3><div class="history-list">${renderHistory(editsByProject.get(project.id))}</div></section>`;
  detailsDialog.showModal();
}

function openEditor(project) {
  editingId = project.id;
  editMessage.textContent = '';
  editDialog.querySelector('#projectEditTitle').textContent = `${serial(project)} · ${project.project_name}`;
  editForm.innerHTML = editableFields.map(field => {
    const value = project[field.key] ?? '';
    if (field.type === 'select') {
      return `<label class="portal-field${field.wide ? ' wide' : ''}"><span>${escapeText(field.label)}</span><select data-field="${field.key}">${field.options.map(([option, label]) => `<option value="${option}"${String(value || (field.key === 'payment_status' ? 'unpaid' : '')) === option ? ' selected' : ''}>${label}</option>`).join('')}</select></label>`;
    }
    if (field.type === 'textarea') {
      return `<label class="portal-field wide"><span>${escapeText(field.label)}</span><textarea rows="4" data-field="${field.key}">${escapeText(value)}</textarea></label>`;
    }
    return `<label class="portal-field${field.wide ? ' wide' : ''}"><span>${escapeText(field.label)}</span><input type="${field.type}" data-field="${field.key}" value="${escapeText(value)}"></label>`;
  }).join('');
  editDialog.showModal();
}

async function loadProjects() {
  const [projectsResult, editsResult] = await Promise.all([
    adminPortal.client.from('projects').select('*').order('serial_number', { ascending: false }),
    adminPortal.client.from('project_edits').select('*').order('created_at', { ascending: false })
  ]);
  if (projectsResult.error) {
    adminMessage.textContent = projectsResult.error.message;
    adminMessage.className = 'portal-message error';
    return;
  }
  allProjects = projectsResult.data || [];
  editsByProject = new Map();
  (editsResult.data || []).forEach(edit => {
    if (!editsByProject.has(edit.project_id)) editsByProject.set(edit.project_id, []);
    editsByProject.get(edit.project_id).push(edit);
  });
  populateClientFilter();
  render();
}

(async () => {
  const auth = await adminPortal.requireUser({ admin: true });
  if (!auth) return;
  await loadProjects();
})();

search.addEventListener('input', render);
filter.addEventListener('change', render);
clientFilter.addEventListener('change', render);
paymentFilter.addEventListener('change', render);

tbody.addEventListener('click', event => {
  const viewButton = event.target.closest('[data-view-project]');
  const editButton = event.target.closest('[data-edit-project]');
  const deleteButton = event.target.closest('[data-delete-project]');
  if (viewButton) {
    const project = allProjects.find(item => item.id === viewButton.dataset.viewProject);
    if (project) openProjectDetails(project);
  } else if (editButton) {
    const project = allProjects.find(item => item.id === editButton.dataset.editProject);
    if (project) openEditor(project);
  } else if (deleteButton) {
    const project = allProjects.find(item => item.id === deleteButton.dataset.deleteProject);
    if (!project) return;
    deletingId = project.id;
    deleteMessage.textContent = '';
    deleteDialog.querySelector('#deleteProjectName').textContent = `${serial(project)} · ${project.project_name}`;
    deleteDialog.showModal();
  }
});

tbody.addEventListener('change', async event => {
  const projectSelect = event.target.closest('[data-project-status]');
  const paymentSelect = event.target.closest('[data-payment-status]');
  if (!projectSelect && !paymentSelect) return;
  const select = projectSelect || paymentSelect;
  const id = projectSelect ? select.dataset.projectStatus : select.dataset.paymentStatus;
  const column = projectSelect ? 'status' : 'payment_status';
  const label = projectSelect ? 'Project status' : 'Payment status';
  adminMessage.textContent = `Updating ${label.toLowerCase()}...`;
  const { error } = await adminPortal.client.from('projects').update({ [column]: select.value }).eq('id', id);
  adminMessage.textContent = error ? error.message : `${label} updated.`;
  adminMessage.className = `portal-message ${error ? 'error' : 'success'}`;
  if (!error) await loadProjects();
});

document.querySelector('#saveProjectEdit').addEventListener('click', async () => {
  if (!editingId) return;
  const payload = {};
  const missing = [];
  editForm.querySelectorAll('[data-field]').forEach(input => {
    const field = editableFields.find(item => item.key === input.dataset.field);
    const raw = input.value.trim();
    if (raw === '' && field.required) { missing.push(field.label); return; }
    payload[input.dataset.field] = raw === '' ? null : (field.type === 'number' ? Number(raw) : raw);
  });
  if (missing.length) {
    editMessage.textContent = `Required field${missing.length === 1 ? '' : 's'} cannot be empty: ${missing.join(', ')}.`;
    editMessage.className = 'portal-message error';
    return;
  }
  editMessage.textContent = 'Saving...';
  editMessage.className = 'portal-message';
  const { error } = await adminPortal.client.from('projects').update(payload).eq('id', editingId);
  if (error) {
    editMessage.textContent = error.message;
    editMessage.className = 'portal-message error';
    return;
  }
  editDialog.close();
  editingId = null;
  adminMessage.textContent = 'Project updated.';
  adminMessage.className = 'portal-message success';
  await loadProjects();
});

document.querySelector('#confirmDelete').addEventListener('click', async () => {
  if (!deletingId) return;
  deleteMessage.textContent = 'Deleting...';
  deleteMessage.className = 'portal-message';
  const { error } = await adminPortal.client.from('projects').delete().eq('id', deletingId);
  if (error) {
    deleteMessage.textContent = error.message;
    deleteMessage.className = 'portal-message error';
    return;
  }
  deleteDialog.close();
  deletingId = null;
  adminMessage.textContent = 'Project deleted and archived to the Deleted Projects page.';
  adminMessage.className = 'portal-message success';
  await loadProjects();
});

document.querySelector('[data-close-project]').addEventListener('click', () => detailsDialog.close());
detailsDialog.addEventListener('click', event => { if (event.target === detailsDialog) detailsDialog.close(); });
editDialog.querySelectorAll('[data-close-edit]').forEach(button => button.addEventListener('click', () => { editDialog.close(); editingId = null; }));
deleteDialog.querySelectorAll('[data-close-delete]').forEach(button => button.addEventListener('click', () => { deleteDialog.close(); deletingId = null; }));
document.querySelector('[data-signout]').addEventListener('click', () => adminPortal.signOut());
