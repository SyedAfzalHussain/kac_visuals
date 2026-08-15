const adminPortal = window.KarrarPortal;
const tbody = document.querySelector('#adminProjects');
const search = document.querySelector('#projectSearch');
const filter = document.querySelector('#statusFilter');
const adminMessage = document.querySelector('#adminMessage');
const detailsDialog = document.querySelector('#projectDetailsDialog');
const detailsContent = document.querySelector('#adminProjectDetails');
const statuses = [['submitted','Submitted'],['reviewing','Reviewing'],['awaiting_files','Awaiting Files'],['in_progress','In Progress'],['in_review','In Review'],['completed','Completed'],['cancelled','Cancelled']];
const paymentStatuses = [['unpaid','Unpaid'],['invoice_sent','Invoice Sent'],['partially_paid','Partially Paid'],['paid','Paid'],['refunded','Refunded']];
let allProjects = [];

function escapeText(value = '') { const node = document.createElement('div'); node.textContent = value; return node.innerHTML; }
function labelFor(options, value) { return options.find(([key]) => key === value)?.[1] || value || 'Not provided'; }
function money(value) { return `$${Number(value || 0).toFixed(0)}`; }
function dateTime(value) { return value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Not provided'; }
function safeHttpUrl(value) {
  if (!value) return '';
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
}
function detail(label, value, wide = false) { return `<div class="portal-detail-item${wide ? ' wide' : ''}"><small>${escapeText(label)}</small><strong>${escapeText(value || 'Not provided')}</strong></div>`; }
function linkDetail(label, value) {
  const url = safeHttpUrl(value);
  return `<div class="portal-detail-item wide"><small>${escapeText(label)}</small>${url ? `<a href="${url}" target="_blank" rel="noopener">Open saved link ↗</a><span>${escapeText(value)}</span>` : `<strong>${escapeText(value || 'Not provided')}</strong>`}</div>`;
}

function render() {
  const query = search.value.toLowerCase().trim(), status = filter.value;
  const projects = allProjects.filter(project => (!status || project.status === status) && (!query || [project.project_name,project.client_name,project.client_email,project.company,project.phone,project.submission_id].some(value => String(value || '').toLowerCase().includes(query))));
  tbody.innerHTML = projects.length ? projects.map(project => `<tr>
    <td><strong>${project.service_name ? `Video ${String(project.project_number || 1).padStart(2, '0')} · ` : ''}${escapeText(project.project_name)}</strong><span>${escapeText(project.format || '')}${project.aimed_length ? ` · ${project.aimed_length}s` : ''}${project.color_profile ? ` · ${escapeText(project.color_profile)}` : ''}</span><button class="admin-view-button" type="button" data-view-project="${project.id}">View all details</button></td>
    <td><strong>${escapeText(project.client_name)}${project.client_id ? '' : ' · Guest'}</strong><span>${escapeText(project.client_email)}${project.company ? ` · ${escapeText(project.company)}` : ''}</span></td>
    <td>${(project.services || []).map(service => `${escapeText(service.name)} × ${service.quantity}`).join('<br>')}${project.ai_addon_scenes ? `<br><span>AI: ${project.ai_addon_scenes} scene${project.ai_addon_scenes === 1 ? '' : 's'} (+${money(project.ai_addon_price)})</span>` : ''}</td>
    <td>${money(project.estimated_total)}</td><td>${new Date(project.created_at).toLocaleDateString()}</td>
    <td><select data-project-status="${project.id}">${statuses.map(([value,label]) => `<option value="${value}"${project.status === value ? ' selected' : ''}>${label}</option>`).join('')}</select></td>
    <td><select data-payment-status="${project.id}">${paymentStatuses.map(([value,label]) => `<option value="${value}"${(project.payment_status || 'unpaid') === value ? ' selected' : ''}>${label}</option>`).join('')}</select></td>
  </tr>`).join('') : '<tr><td colspan="7">No projects found.</td></tr>';
}

function openProjectDetails(project) {
  const services = (project.services || []).map(service => `${service.name} × ${service.quantity}`).join(', ') || project.service_name || 'Not provided';
  const phoneHref = String(project.phone || '').replace(/[^0-9+]/g, '');
  detailsContent.innerHTML = `<header class="portal-detail-heading"><p class="kicker">Complete Saved Request</p><h2 id="projectDetailsTitle">${escapeText(project.project_name)}</h2><div class="project-card-badges"><span class="status-badge">${escapeText(labelFor(statuses, project.status))}</span><span class="payment-badge" data-payment="${project.payment_status || 'unpaid'}">Payment · ${escapeText(labelFor(paymentStatuses, project.payment_status || 'unpaid'))}</span></div></header>
    <section class="portal-detail-section"><h3>Client Contact</h3><div class="portal-detail-grid">${detail('Full name', project.client_name)}<div class="portal-detail-item"><small>Email</small><a href="mailto:${encodeURIComponent(project.client_email || '')}">${escapeText(project.client_email)}</a></div><div class="portal-detail-item"><small>Phone / WhatsApp</small>${phoneHref ? `<a href="tel:${phoneHref}">${escapeText(project.phone)}</a>` : '<strong>Not provided</strong>'}</div>${detail('Company', project.company)}${detail('Account type', project.client_id ? 'Registered client' : 'Guest')}</div></section>
    <section class="portal-detail-section"><h3>Project Brief</h3><div class="portal-detail-grid">${detail('Service', services)}${detail('Video number', String(project.project_number || 1).padStart(2, '0'))}${detail('Format', project.format)}${detail('Aimed length', project.aimed_length ? `${project.aimed_length}s` : '')}${detail('Color profile', project.color_profile)}${detail('Preferred music', project.preferred_music)}${detail('AI add-on', project.ai_addon_scenes ? `${project.ai_addon_scenes} scene${project.ai_addon_scenes === 1 ? '' : 's'} · ${money(project.ai_addon_price)}` : 'Off')}${linkDetail('Footage / project files', project.footage_link)}${linkDetail('Reference video', project.reference_link)}${detail('Creative notes', project.creative_notes, true)}${detail('Internal admin notes', project.admin_notes, true)}</div></section>
    <section class="portal-detail-section"><h3>Pricing &amp; Record</h3><div class="portal-detail-grid">${detail('Base price', money(project.unit_price || Number(project.estimated_total) - Number(project.ai_addon_price || 0)))}${detail('AI add-on price', money(project.ai_addon_price))}${detail('Estimated total', money(project.estimated_total))}${detail('Payment status', labelFor(paymentStatuses, project.payment_status || 'unpaid'))}${detail('Project status', labelFor(statuses, project.status))}${detail('Submitted', dateTime(project.created_at))}${detail('Last updated', dateTime(project.updated_at))}${detail('Submission ID', project.submission_id, true)}${detail('Project ID', project.id, true)}</div></section>`;
  detailsDialog.showModal();
}

(async () => {
  const auth = await adminPortal.requireUser({ admin: true });
  if (!auth) return;
  const { data, error } = await adminPortal.client.from('projects').select('*').order('created_at', { ascending: false });
  if (error) { adminMessage.textContent = error.message; adminMessage.className = 'portal-message error'; return; }
  allProjects = data || []; render();
})();

search.addEventListener('input', render);
filter.addEventListener('change', render);
tbody.addEventListener('click', event => {
  const button = event.target.closest('[data-view-project]');
  if (!button) return;
  const project = allProjects.find(item => item.id === button.dataset.viewProject);
  if (project) openProjectDetails(project);
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
  const { error } = await adminPortal.client.from('projects').update({ [column]: select.value, updated_at: new Date().toISOString() }).eq('id', id);
  adminMessage.textContent = error ? error.message : `${label} updated.`;
  adminMessage.className = `portal-message ${error ? 'error' : 'success'}`;
  if (!error) { const project = allProjects.find(item => item.id === id); if (project) project[column] = select.value; }
});

document.querySelector('[data-close-project]').addEventListener('click', () => detailsDialog.close());
detailsDialog.addEventListener('click', event => { if (event.target === detailsDialog) detailsDialog.close(); });
document.querySelector('[data-signout]').addEventListener('click', () => adminPortal.signOut());
