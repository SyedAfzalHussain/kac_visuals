const adminPortal = window.KarrarPortal;
const tbody = document.querySelector('#adminProjects');
const search = document.querySelector('#projectSearch');
const filter = document.querySelector('#statusFilter');
const adminMessage = document.querySelector('#adminMessage');
const statuses = [['submitted','Submitted'],['reviewing','Reviewing'],['awaiting_files','Awaiting Files'],['in_progress','In Progress'],['in_review','In Review'],['completed','Completed'],['cancelled','Cancelled']];
let allProjects = [];
function escapeText(value = '') { const node = document.createElement('div'); node.textContent = value; return node.innerHTML; }
function render() {
  const query = search.value.toLowerCase().trim(), status = filter.value;
  const projects = allProjects.filter(project => (!status || project.status === status) && (!query || [project.project_name,project.client_name,project.client_email,project.company].some(value => String(value || '').toLowerCase().includes(query))));
  tbody.innerHTML = projects.length ? projects.map(project => `<tr><td><strong>${escapeText(project.project_name)}</strong><span>${escapeText(project.format || '')}</span></td><td><strong>${escapeText(project.client_name)}</strong><span>${escapeText(project.client_email)}${project.company ? ` · ${escapeText(project.company)}` : ''}</span></td><td>${(project.services || []).map(service => `${escapeText(service.name)} × ${service.quantity}`).join('<br>')}</td><td>$${Number(project.estimated_total).toFixed(0)}</td><td>${new Date(project.created_at).toLocaleDateString()}</td><td><select data-project-status="${project.id}">${statuses.map(([value,label]) => `<option value="${value}"${project.status === value ? ' selected' : ''}>${label}</option>`).join('')}</select></td></tr>`).join('') : '<tr><td colspan="6">No projects found.</td></tr>';
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
  const select = event.target.closest('[data-project-status]'); if (!select) return;
  adminMessage.textContent = 'Updating status...';
  const { error } = await adminPortal.client.from('projects').update({ status: select.value, updated_at: new Date().toISOString() }).eq('id', select.dataset.projectStatus);
  adminMessage.textContent = error ? error.message : 'Project status updated.'; adminMessage.className = `portal-message ${error ? 'error' : 'success'}`;
  if (!error) { const project = allProjects.find(item => item.id === select.dataset.projectStatus); if (project) project.status = select.value; }
});
document.querySelector('[data-signout]').addEventListener('click', () => adminPortal.signOut());
