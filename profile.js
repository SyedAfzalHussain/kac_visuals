const profilePortal = window.KarrarPortal;
const projectsList = document.querySelector('#projectsList');
const profileCard = document.querySelector('#profileCard');
const statusLabels = { submitted: 'Submitted', reviewing: 'Reviewing', awaiting_files: 'Awaiting Files', in_progress: 'In Progress', in_review: 'In Review', completed: 'Completed', cancelled: 'Cancelled' };

function escapeText(value = '') { const node = document.createElement('div'); node.textContent = value; return node.innerHTML; }
function renderProjects(projects) {
  if (!projects.length) { projectsList.innerHTML = '<div class="portal-empty">No projects yet. Start your first project when you’re ready.</div>'; return; }
  projectsList.innerHTML = projects.map(project => `<article class="project-card"><div class="project-card-head"><div>${project.service_name ? `<span class="project-sequence">Video ${String(project.project_number || 1).padStart(2, '0')} · ${escapeText(project.service_name)}</span>` : ''}<h2>${escapeText(project.project_name)}</h2><time>${new Date(project.created_at).toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'})}</time></div><span class="status-badge">${statusLabels[project.status] || project.status}</span></div><div class="project-services">${(project.services || []).map(service => `<span>${escapeText(service.name)} × ${service.quantity}</span>`).join('')}</div><div class="project-meta"><div><small>Format</small><strong>${escapeText(project.format || 'To be discussed')}</strong></div><div><small>Aimed Length</small><strong>${project.aimed_length ? `${project.aimed_length}s` : 'Not provided'}</strong></div><div><small>Color Profile</small><strong>${escapeText(project.color_profile || 'Not provided')}</strong></div><div><small>Music</small><strong>${escapeText(project.preferred_music || 'To be discussed')}</strong></div><div><small>AI Add-On</small><strong>${project.ai_addon_scenes ? `${project.ai_addon_scenes} scene${project.ai_addon_scenes === 1 ? '' : 's'} · $${Number(project.ai_addon_price).toFixed(0)}` : 'Off'}</strong></div><div><small>Estimate</small><strong>$${Number(project.estimated_total).toFixed(0)}</strong></div></div></article>`).join('');
}

(async () => {
  const auth = await profilePortal.requireUser();
  if (!auth) return;
  const name = auth.profile?.full_name || auth.user.user_metadata?.full_name || 'Client';
  profileCard.querySelector('.profile-avatar').textContent = name.charAt(0).toUpperCase();
  profileCard.querySelector('h2').textContent = name;
  profileCard.querySelector('p').textContent = auth.user.email;
  profileCard.querySelector('.role-badge').textContent = auth.profile?.role === 'admin' ? 'Administrator' : 'Client';
  if (auth.profile?.role === 'admin') {
    const link = document.createElement('a'); link.className = 'button button-outline button-small'; link.href = '/admin/'; link.textContent = 'Admin Dashboard'; link.style.marginTop = '20px'; profileCard.appendChild(link);
  }
  const { data, error } = await profilePortal.client.from('projects').select('*').order('created_at', { ascending: false });
  if (error) projectsList.innerHTML = `<div class="portal-empty">${escapeText(error.message)}</div>`;
  else renderProjects(data || []);
})();
document.querySelector('[data-signout]').addEventListener('click', () => profilePortal.signOut());
