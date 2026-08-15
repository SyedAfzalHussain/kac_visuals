const adminPortal = window.KarrarPortal;
const tbody = document.querySelector('#adminProjects');
const search = document.querySelector('#projectSearch');
const filter = document.querySelector('#statusFilter');
const adminMessage = document.querySelector('#adminMessage');
const statuses = [['submitted','Submitted'],['reviewing','Reviewing'],['awaiting_files','Awaiting Files'],['in_progress','In Progress'],['in_review','In Review'],['completed','Completed'],['cancelled','Cancelled']];
const paymentStatuses = [['unpaid','Unpaid'],['invoice_sent','Invoice Sent'],['partially_paid','Partially Paid'],['paid','Paid'],['refunded','Refunded']];
let allProjects = [];
function escapeText(value = '') { const node = document.createElement('div'); node.textContent = value; return node.innerHTML; }
function render() {
  const query = search.value.toLowerCase().trim(), status = filter.value;
  const projects = allProjects.filter(project => (!status || project.status === status) && (!query || [project.project_name,project.client_name,project.client_email,project.company].some(value => String(value || '').toLowerCase().includes(query))));
  tbody.innerHTML = projects.length ? projects.map(project => `<tr><td><strong>${project.service_name ? `Video ${String(project.project_number || 1).padStart(2, '0')} · ` : ''}${escapeText(project.project_name)}</strong><span>${escapeText(project.format || '')}${project.aimed_length ? ` · ${project.aimed_length}s` : ''}${project.color_profile ? ` · ${escapeText(project.color_profile)}` : ''}</span></td><td><strong>${escapeText(project.client_name)}${project.client_id ? '' : ' · Guest'}</strong><span>${escapeText(project.client_email)}${project.company ? ` · ${escapeText(project.company)}` : ''}</span></td><td>${(project.services || []).map(service => `${escapeText(service.name)} × ${service.quantity}`).join('<br>')}${project.ai_addon_scenes ? `<br><span>AI: ${project.ai_addon_scenes} scene${project.ai_addon_scenes === 1 ? '' : 's'} (+$${Number(project.ai_addon_price).toFixed(0)})</span>` : ''}</td><td>$${Number(project.estimated_total).toFixed(0)}</td><td>${new Date(project.created_at).toLocaleDateString()}</td><td><select data-project-status="${project.id}">${statuses.map(([value,label]) => `<option value="${value}"${project.status === value ? ' selected' : ''}>${label}</option>`).join('')}</select></td><td><select data-payment-status="${project.id}">${paymentStatuses.map(([value,label]) => `<option value="${value}"${(project.payment_status || 'unpaid') === value ? ' selected' : ''}>${label}</option>`).join('')}</select></td></tr>`).join('') : '<tr><td colspan="7">No projects found.</td></tr>';
}
(async () => {
  const auth = await adminPortal.requireUser({ admin: true });
  if (!auth) return;
  const { data, error } = await adminPortal.client.from('projects').select('*').order('created_at', { ascending: false });
  if (error) { adminMessage.textContent = error.message; adminMessage.className = 'portal-message error'; return; }
  allProjects = data || []; render();
})();
search.addEventListener('input', render); filter.addEventListener('change', render);
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
  adminMessage.textContent = error ? error.message : `${label} updated.`; adminMessage.className = `portal-message ${error ? 'error' : 'success'}`;
  if (!error) { const project = allProjects.find(item => item.id === id); if (project) project[column] = select.value; }
});
document.querySelector('[data-signout]').addEventListener('click', () => adminPortal.signOut());
