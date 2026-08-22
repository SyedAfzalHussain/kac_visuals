const archivePortal = window.KarrarPortal;
const archiveBody = document.querySelector('#deletedProjects');
const archiveSearch = document.querySelector('#deletedSearch');
const archiveMessage = document.querySelector('#deletedMessage');
const archiveDialog = document.querySelector('#deletedDetailsDialog');
const archiveDetails = document.querySelector('#deletedProjectDetails');
const purgeDialog = document.querySelector('#purgeConfirmDialog');
const purgeMessage = document.querySelector('#purgeMessage');
const statuses = [['submitted','Submitted'],['reviewing','Reviewing'],['awaiting_files','Awaiting Files'],['in_progress','In Progress'],['in_review','In Review'],['completed','Completed'],['cancelled','Cancelled']];
const paymentStatuses = [['unpaid','Unpaid'],['invoice_sent','Invoice Sent'],['partially_paid','Partially Paid'],['paid','Paid'],['refunded','Refunded']];
const fieldLabels = {
  project_name: 'Project name', status: 'Project status', payment_status: 'Payment status',
  final_video_link: 'Final video link', creative_notes: 'Creative notes and Script', admin_notes: 'Internal admin notes',
  format: 'Format', preferred_music: 'Preferred music', footage_link: 'Footage / project files',
  reference_link: 'Reference video', aimed_length: 'Aimed length', color_profile: 'Color profile',
  estimated_total: 'Estimated total', unit_price: 'Base price', phone: 'Phone / WhatsApp',
  company: 'Company', client_name: 'Client name', client_email: 'Client email',
  service_name: 'Service', ai_addon_scenes: 'AI add-on scenes'
};
let archived = [];
let purgingId = null;

function escapeText(value = '') { const node = document.createElement('div'); node.textContent = value; return node.innerHTML; }
function labelFor(options, value) { return options.find(([key]) => key === value)?.[1] || value || 'Not provided'; }
function money(value) { return `$${Number(value || 0).toFixed(0)}`; }
function dateTime(value) { return value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Not provided'; }
function serialOf(value) { return value ? `#${String(value).padStart(3, '0')}` : '—'; }
function safeHttpUrl(value) {
  if (!value) return '';
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
}
function detail(label, value, wide = false, copyable = false) { return `<div class="portal-detail-item${wide ? ' wide' : ''}"><small>${escapeText(label)}</small><strong>${escapeText(value || 'Not provided')}</strong>${copyable ? archivePortal.copyButton(value) : ''}</div>`; }
function linkDetail(label, value) {
  const url = safeHttpUrl(value);
  return `<div class="portal-detail-item wide"><small>${escapeText(label)}</small>${url ? `<a href="${url}" target="_blank" rel="noopener">Open saved link ↗</a><span>${escapeText(value)}</span>` : `<strong>${escapeText(value || 'Not provided')}</strong>`}${archivePortal.copyButton(value)}</div>`;
}
function historyValue(field, value) {
  if (value === null || value === '') return 'Empty';
  if (field === 'status') return labelFor(statuses, value);
  if (field === 'payment_status') return labelFor(paymentStatuses, value);
  return value;
}

function renderHistory(edits) {
  if (!edits?.length) return '<p class="history-empty">No edits were recorded for this project.</p>';
  return edits.map(edit => `<div class="history-entry">
    <div class="history-head"><strong>${escapeText(fieldLabels[edit.field] || edit.field)}</strong><span>${escapeText(dateTime(edit.created_at))} · ${escapeText(edit.edited_by_name || 'Unknown user')}${edit.edited_by_role ? ` · ${escapeText(edit.edited_by_role)}` : ''}</span></div>
    <div class="history-values">
      <div class="history-old"><small>Before</small><span>${escapeText(historyValue(edit.field, edit.old_value))}</span></div>
      <div class="history-new"><small>After</small><span>${escapeText(historyValue(edit.field, edit.new_value))}</span></div>
    </div>
  </div>`).join('');
}

function render() {
  const query = archiveSearch.value.toLowerCase().trim();
  const rows = archived.filter(entry => !query || [entry.project_name, entry.client_name, entry.client_email, serialOf(entry.serial_number)].some(value => String(value || '').toLowerCase().includes(query)));
  archiveBody.innerHTML = rows.length ? rows.map(entry => `<tr>
    <td><strong class="serial-cell">${escapeText(serialOf(entry.serial_number))}</strong></td>
    <td><strong>${escapeText(entry.project_name || 'Untitled project')}</strong><button class="admin-view-button" type="button" data-view-archived="${entry.id}">View all details</button></td>
    <td><strong>${escapeText(entry.client_name || 'Unknown')}</strong><span>${escapeText(entry.client_email || '')}</span></td>
    <td>${escapeText(dateTime(entry.deleted_at))}</td>
    <td>${escapeText(entry.deleted_by_name || 'Unknown')}</td>
    <td><div class="row-actions"><button class="admin-row-button" type="button" data-restore="${entry.id}">Restore</button><button class="admin-row-button danger" type="button" data-purge="${entry.id}">Erase</button></div></td>
  </tr>`).join('') : '<tr><td colspan="6">No deleted projects in the archive.</td></tr>';
}

function openDetails(entry) {
  const project = entry.project_data || {};
  const services = (project.services || []).map(service => `${service.name} × ${Number(service.quantity) || 0}`).join(', ') || project.service_name || 'Not provided';
  archiveDetails.innerHTML = `<header class="portal-detail-heading"><p class="kicker">Archived Backup · ${escapeText(serialOf(entry.serial_number))}</p><h2 id="deletedDetailsTitle">${escapeText(project.project_name || 'Untitled project')}</h2><div class="project-card-badges"><span class="status-badge">${escapeText(labelFor(statuses, project.status))}</span><span class="payment-badge" data-payment="${project.payment_status || 'unpaid'}">Payment · ${escapeText(labelFor(paymentStatuses, project.payment_status || 'unpaid'))}</span></div></header>
    <section class="portal-detail-section"><h3>Deletion Record</h3><div class="portal-detail-grid">${detail('Deleted at', dateTime(entry.deleted_at))}${detail('Deleted by', entry.deleted_by_name || 'Unknown')}</div></section>
    <section class="portal-detail-section"><h3>Client Contact</h3><div class="portal-detail-grid">${detail('Full name', project.client_name)}${detail('Email', project.client_email)}${detail('Phone / WhatsApp', project.phone)}${detail('Company', project.company)}${detail('Account type', project.client_id ? 'Registered client' : 'Guest')}</div></section>
    <section class="portal-detail-section"><h3>Project Brief</h3><div class="portal-detail-grid">${detail('Serial number', serialOf(entry.serial_number))}${detail('Service', services)}${detail('Format', project.format)}${detail('Aimed length', project.aimed_length ? `${project.aimed_length}s` : '')}${detail('Color profile', project.color_profile)}${detail('Preferred music', project.preferred_music)}${linkDetail('Final video link', project.final_video_link)}${linkDetail('Footage / project files', project.footage_link)}${linkDetail('Reference video', project.reference_link)}${detail('Creative notes and Script', project.creative_notes, true, true)}${detail('Internal admin notes', project.admin_notes, true, true)}</div></section>
    <section class="portal-detail-section"><h3>Pricing &amp; Record</h3><div class="portal-detail-grid">${detail('Estimated total', money(project.estimated_total))}${detail('Payment status', labelFor(paymentStatuses, project.payment_status || 'unpaid'))}${detail('Project status', labelFor(statuses, project.status))}${detail('Submitted', dateTime(project.created_at))}${detail('Submission ID', project.submission_id, true)}${detail('Project ID', entry.id, true)}</div></section>
    <section class="portal-detail-section"><h3>Edit History</h3><div class="history-list">${renderHistory(entry.edit_history)}</div></section>`;
  archiveDialog.showModal();
}

async function loadArchive() {
  const { data, error } = await archivePortal.client.from('deleted_projects').select('*').order('deleted_at', { ascending: false });
  if (error) {
    archiveMessage.textContent = error.message;
    archiveMessage.className = 'portal-message error';
    return;
  }
  archived = data || [];
  render();
}

(async () => {
  const auth = await archivePortal.requireUser({ admin: true });
  if (!auth) return;
  archivePortal.releaseGate();
  await loadArchive();
})();

archiveSearch.addEventListener('input', render);

archiveBody.addEventListener('click', async event => {
  const viewButton = event.target.closest('[data-view-archived]');
  const restoreButton = event.target.closest('[data-restore]');
  const purgeButton = event.target.closest('[data-purge]');
  if (viewButton) {
    const entry = archived.find(item => item.id === viewButton.dataset.viewArchived);
    if (entry) openDetails(entry);
  } else if (restoreButton) {
    const entry = archived.find(item => item.id === restoreButton.dataset.restore);
    if (!entry) return;
    archiveMessage.textContent = 'Restoring project...';
    archiveMessage.className = 'portal-message';
    const { error } = await archivePortal.client.rpc('restore_deleted_project', { p_id: entry.id });
    archiveMessage.textContent = error ? error.message : 'Project restored to the live dashboard.';
    archiveMessage.className = `portal-message ${error ? 'error' : 'success'}`;
    if (!error) await loadArchive();
  } else if (purgeButton) {
    const entry = archived.find(item => item.id === purgeButton.dataset.purge);
    if (!entry) return;
    purgingId = entry.id;
    purgeMessage.textContent = '';
    purgeDialog.querySelector('#purgeProjectName').textContent = `${serialOf(entry.serial_number)} · ${entry.project_name || 'Untitled project'}`;
    purgeDialog.showModal();
  }
});

document.querySelector('#confirmPurge').addEventListener('click', async () => {
  if (!purgingId) return;
  purgeMessage.textContent = 'Erasing...';
  purgeMessage.className = 'portal-message';
  const { error } = await archivePortal.client.from('deleted_projects').delete().eq('id', purgingId);
  if (error) {
    purgeMessage.textContent = error.message;
    purgeMessage.className = 'portal-message error';
    return;
  }
  purgeDialog.close();
  purgingId = null;
  archiveMessage.textContent = 'Project permanently erased from the backup.';
  archiveMessage.className = 'portal-message success';
  await loadArchive();
});

document.querySelector('[data-close-details]').addEventListener('click', () => archiveDialog.close());
archiveDialog.addEventListener('click', event => { if (event.target === archiveDialog) archiveDialog.close(); });
purgeDialog.querySelectorAll('[data-close-purge]').forEach(button => button.addEventListener('click', () => { purgeDialog.close(); purgingId = null; }));
document.querySelector('[data-signout]').addEventListener('click', () => archivePortal.signOut());
