const adminPortal = window.KarrarPortal;
const tbody = document.querySelector('#adminProjects');
const search = document.querySelector('#projectSearch');
const filter = document.querySelector('#statusFilter');
const clientFilter = document.querySelector('#clientFilter');
const paymentFilter = document.querySelector('#paymentFilter');
const customToggle = document.querySelector('#customToggle');
const adminMessage = document.querySelector('#adminMessage');
const detailsDialog = document.querySelector('#projectDetailsDialog');
const detailsContent = document.querySelector('#adminProjectDetails');
const editDialog = document.querySelector('#projectEditDialog');
const editForm = document.querySelector('#projectEditForm');
const editMessage = document.querySelector('#editMessage');
const deleteDialog = document.querySelector('#deleteConfirmDialog');
const deleteMessage = document.querySelector('#deleteMessage');
const editorsDialog = document.querySelector('#editorsDialog');
const editorsList = document.querySelector('#editorsList');
const editorsMessage = document.querySelector('#editorsMessage');
const editorsSearch = document.querySelector('#editorsSearch');
const printRoot = document.querySelector('#printRoot');
const statuses = [['submitted','Submitted'],['reviewing','Reviewing'],['awaiting_files','Awaiting Files'],['in_progress','In Progress'],['in_review','In Review'],['completed','Completed'],['cancelled','Cancelled']];
const paymentStatuses = [['unpaid','Unpaid'],['invoice_sent','Invoice Sent'],['partially_paid','Partially Paid'],['paid','Paid'],['refunded','Refunded']];
const DAY_MS = 24 * 60 * 60 * 1000;
const fieldLabels = {
  project_name: 'Project name', status: 'Project status', payment_status: 'Payment status',
  final_video_link: 'Final video link', creative_notes: 'Creative notes and Script', admin_notes: 'Internal admin notes',
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
  { key: 'client_budget', label: 'Client proposed budget ($)', type: 'number' },
  { key: 'footage_link', label: 'Footage / project files', type: 'url', wide: true },
  { key: 'reference_link', label: 'Reference video', type: 'url', wide: true },
  { key: 'creative_notes', label: 'Creative notes and Script', type: 'textarea', wide: true, required: true },
  { key: 'admin_notes', label: 'Internal admin notes', type: 'textarea', wide: true }
];
let allProjects = [];
let editsByProject = new Map();
let people = [];
let editingId = null;
let deletingId = null;
let detailProjectId = null;
let customOnly = false;

function escapeText(value = '') { const node = document.createElement('div'); node.textContent = value; return node.innerHTML; }
function labelFor(options, value) { return options.find(([key]) => key === value)?.[1] || value || 'Not provided'; }
function money(value) { return `$${Number(value || 0).toFixed(0)}`; }
function dateTime(value) { return value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Not provided'; }
function serial(project) { return project.serial_number ? `#${String(project.serial_number).padStart(3, '0')}` : '—'; }
function isFresh(project) { return Date.now() - new Date(project.created_at).getTime() < DAY_MS; }
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
function historyValue(field, value) {
  if (value === null || value === '') return 'Empty';
  if (field === 'status') return labelFor(statuses, value);
  if (field === 'payment_status') return labelFor(paymentStatuses, value);
  return value;
}
function servicesOf(project) {
  return (project.services || []).map(service => `${service.name} × ${Number(service.quantity) || 0}`).join(', ') || project.service_name || '';
}
function editors() { return people.filter(person => person.role === 'editor'); }

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

function projectRow(project) {
  const editCount = editsByProject.get(project.id)?.length || 0;
  const fresh = isFresh(project);
  const assigned = project.assigned_editor_id || '';
  return `<tr${fresh ? ' class="fresh-row"' : ''}>
    <td><strong class="serial-cell">${escapeText(serial(project))}</strong></td>
    <td><strong>${project.service_name ? `Video ${String(project.project_number || 1).padStart(2, '0')} · ` : ''}${escapeText(project.project_name)}</strong><span>${escapeText(project.format || '')}${project.aimed_length ? ` · ${formatLength(project.aimed_length)}` : ''}${project.color_profile ? ` · ${escapeText(project.color_profile)}` : ''}</span>${fresh ? '<span class="new-badge">New</span>' : ''}${project.is_custom ? '<span class="custom-badge">Custom</span>' : ''}${editCount ? `<span class="edited-badge">Edited · ${editCount} change${editCount === 1 ? '' : 's'}</span>` : ''}<button class="admin-view-button" type="button" data-view-project="${project.id}">View all details</button></td>
    <td><strong>${escapeText(project.client_name)}${project.client_id ? '' : ' · Guest'}</strong><span>${escapeText(project.client_email)}${project.company ? ` · ${escapeText(project.company)}` : ''}</span></td>
    <td>${(project.services || []).map(service => `${escapeText(service.name)} × ${Number(service.quantity) || 0}`).join('<br>')}${project.ai_addon_scenes ? `<br><span>AI: ${project.ai_addon_scenes} scene${project.ai_addon_scenes === 1 ? '' : 's'} (+${money(project.ai_addon_price)})</span>` : ''}</td>
    <td>${money(project.estimated_total)}${project.client_budget ? `<br><span>Client budget ${money(project.client_budget)}</span>` : ''}</td>
    <td>${new Date(project.created_at).toLocaleDateString()}</td>
    <td><select data-project-status="${project.id}">${statuses.map(([value,label]) => `<option value="${value}"${project.status === value ? ' selected' : ''}>${label}</option>`).join('')}</select></td>
    <td><select data-payment-status="${project.id}">${paymentStatuses.map(([value,label]) => `<option value="${value}"${(project.payment_status || 'unpaid') === value ? ' selected' : ''}>${label}</option>`).join('')}</select></td>
    <td><select data-assign-editor="${project.id}"><option value="">Unassigned</option>${editors().map(person => `<option value="${person.id}"${assigned === person.id ? ' selected' : ''}>${escapeText(person.full_name || person.email)}</option>`).join('')}</select></td>
    <td><div class="row-actions"><button class="admin-row-button" type="button" data-edit-project="${project.id}">Edit</button><button class="admin-row-button danger" type="button" data-delete-project="${project.id}">Delete</button></div></td>
  </tr>`;
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
    && (!customOnly || project.is_custom)
    && (!query || [project.project_name,project.client_name,project.client_email,project.company,project.phone,project.submission_id,serial(project)].some(value => String(value || '').toLowerCase().includes(query))));

  if (!projects.length) { tbody.innerHTML = '<tr><td colspan="10">No projects found.</td></tr>'; return; }

  const fresh = projects.filter(isFresh);
  const earlier = projects.filter(project => !isFresh(project));
  const divider = (label, count, cls) => `<tr class="group-row ${cls}"><td colspan="10">${label}${count ? ` · ${count}` : ''}</td></tr>`;

  tbody.innerHTML = fresh.length
    ? divider('◆ Last 24 Hours', `${fresh.length} new`, 'fresh-group') + fresh.map(projectRow).join('')
      + (earlier.length ? divider('Earlier', '', 'older-group') + earlier.map(projectRow).join('') : '')
    : projects.map(projectRow).join('');
}

function openProjectDetails(project) {
  detailProjectId = project.id;
  const services = servicesOf(project) || 'Not provided';
  const phoneHref = String(project.phone || '').replace(/[^0-9+]/g, '');
  detailsContent.innerHTML = `<header class="portal-detail-heading"><p class="kicker">Complete Saved Request · ${escapeText(serial(project))}</p><h2 id="projectDetailsTitle">${escapeText(project.project_name)}</h2><div class="project-card-badges"><span class="status-badge">${escapeText(labelFor(statuses, project.status))}</span><span class="payment-badge" data-payment="${project.payment_status || 'unpaid'}">Payment · ${escapeText(labelFor(paymentStatuses, project.payment_status || 'unpaid'))}</span>${project.is_custom ? '<span class="custom-badge">Custom Project</span>' : ''}</div></header>
    <section class="portal-detail-section"><h3>Client Contact</h3><div class="portal-detail-grid">${detail('Full name', project.client_name)}<div class="portal-detail-item"><small>Email</small><a href="mailto:${encodeURIComponent(project.client_email || '')}">${escapeText(project.client_email)}</a></div><div class="portal-detail-item"><small>Phone / WhatsApp</small>${phoneHref ? `<a href="tel:${phoneHref}">${escapeText(project.phone)}</a>` : '<strong>Not provided</strong>'}</div>${detail('Company', project.company)}${detail('Account type', project.client_id ? 'Registered client' : 'Guest')}</div></section>
    <section class="portal-detail-section"><h3>Project Brief</h3><div class="portal-detail-grid">${detail('Serial number', serial(project))}${detail('Service', services)}${detail('Video number', String(project.project_number || 1).padStart(2, '0'))}${detail('Format', project.format)}${detail('Aimed length', formatLength(project.aimed_length))}${detail('Color profile', project.color_profile)}${detail('Preferred music', project.preferred_music)}${detail('AI add-on', project.ai_addon_scenes ? `${project.ai_addon_scenes} scene${project.ai_addon_scenes === 1 ? '' : 's'} · ${money(project.ai_addon_price)}` : 'Off')}${detail('Assigned editor', project.assigned_editor_name)}${linkDetail('Final video link', project.final_video_link)}${linkDetail('Footage / project files', project.footage_link)}${linkDetail('Reference video', project.reference_link)}${detail('Creative notes and Script', project.creative_notes, true)}${detail('Internal admin notes', project.admin_notes, true)}</div></section>
    <section class="portal-detail-section"><h3>Pricing &amp; Record</h3><div class="portal-detail-grid">${detail('Base price', money(project.unit_price || Number(project.estimated_total) - Number(project.ai_addon_price || 0)))}${detail('AI add-on price', money(project.ai_addon_price))}${detail('Estimated total', money(project.estimated_total))}${project.client_budget ? detail('Client proposed budget', money(project.client_budget)) : ''}${detail('Payment status', labelFor(paymentStatuses, project.payment_status || 'unpaid'))}${detail('Project status', labelFor(statuses, project.status))}${detail('Submitted', dateTime(project.created_at))}${detail('Last updated', dateTime(project.updated_at))}${detail('Submission ID', project.submission_id, true)}${detail('Project ID', project.id, true)}</div></section>
    <section class="portal-detail-section"><h3>Edit History</h3><div class="history-list">${renderHistory(editsByProject.get(project.id))}</div></section>`;
  detailsDialog.showModal();
}

// --- PDF: branded, print-only brief. AI add-on price is never printed.
// variant 'full'   -> client contact + brief + notes
// variant 'editor' -> brief + notes only (no client contact, no pricing)
function printPair(label, value) {
  return value ? `<div class="print-cell"><small>${escapeText(label)}</small><span>${escapeText(value)}</span></div>` : '';
}

function buildPrintDoc(project, variant) {
  const editorCopy = variant === 'editor';
  const services = servicesOf(project) || 'Not provided';
  const aiLabel = project.ai_addon_scenes ? `${project.ai_addon_scenes} scene${project.ai_addon_scenes === 1 ? '' : 's'}` : 'Off';

  const clientSection = editorCopy ? '' : `<section class="print-section">
      <h2>Client</h2>
      <div class="print-grid">
        ${printPair('Full name', project.client_name)}
        ${printPair('Email', project.client_email)}
        ${printPair('Phone / WhatsApp', project.phone)}
        ${printPair('Company', project.company)}
      </div>
    </section>`;

  return `<article class="print-doc">
    <header class="print-head">
      <div class="print-brand">
        <img class="print-mark" src="/assets/karrar/favicon-black.png" alt="">
        <div class="print-company">
          <strong>Karrar Enterprises</strong>
          <span>LLC · Premium Video Editing</span>
        </div>
      </div>
      <div class="print-contact">
        <span>karrarvisuals@gmail.com</span>
        <span>+1 402 808 7996</span>
        <span>5830 E 2nd St, Ste 7000</span>
        <span>Casper, WY 82609, United States</span>
      </div>
    </header>

    <div class="print-title">
      <div class="print-serial">${escapeText(serial(project))}</div>
      <div class="print-titlecopy">
        <span class="print-kicker">Project Brief${editorCopy ? ' · Editor Copy' : ''}</span>
        <h1>${escapeText(project.project_name)}</h1>
        <div class="print-pills">
          <span class="print-pill">${escapeText(labelFor(statuses, project.status))}</span>
          <span class="print-pill ghost">Submitted ${escapeText(dateTime(project.created_at))}</span>
          ${project.is_custom ? '<span class="print-pill ghost">Custom Project</span>' : ''}
        </div>
      </div>
    </div>

    ${clientSection}

    <section class="print-section">
      <h2>Project Brief</h2>
      <div class="print-grid">
        ${printPair('Service', services)}
        ${printPair('Video number', String(project.project_number || 1).padStart(2, '0'))}
        ${printPair('Format', project.format)}
        ${printPair('Aimed length', formatLength(project.aimed_length))}
        ${printPair('Color profile', project.color_profile)}
        ${printPair('Preferred music', project.preferred_music)}
        ${printPair('AI add-on', aiLabel)}
        ${printPair('Assigned editor', project.assigned_editor_name)}
      </div>
    </section>

    <section class="print-section">
      <h2>Links</h2>
      <div class="print-grid one">
        ${printPair('Footage / project files', project.footage_link || 'Not provided')}
        ${printPair('Reference video', project.reference_link || 'Not provided')}
        ${printPair('Final video link', project.final_video_link || 'Not delivered yet')}
      </div>
    </section>

    ${project.creative_notes ? `<section class="print-section"><h2>Creative notes and Script</h2><p class="print-notes">${escapeText(project.creative_notes)}</p></section>` : ''}

    <footer class="print-foot">
      <span>${editorCopy ? 'Editor copy · brief only' : 'Internal copy'} · Generated ${escapeText(new Date().toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' }))}</span>
      <span>karrarenterprisesllc.com</span>
    </footer>
  </article>`;
}

async function exportProjectPdf(project, variant = 'full') {
  printRoot.innerHTML = buildPrintDoc(project, variant);
  document.body.classList.add('printing');
  const cleanup = () => { document.body.classList.remove('printing'); printRoot.innerHTML = ''; };
  addEventListener('afterprint', cleanup, { once: true });

  // The print snapshot is taken synchronously, so the logo has to be decoded
  // before we call print() or it comes out blank.
  const logo = printRoot.querySelector('.print-mark');
  if (logo) {
    try {
      if (!logo.complete) await new Promise(resolve => { logo.onload = logo.onerror = resolve; });
      await logo.decode();
    } catch { /* a missing logo must not block the export */ }
  }
  await new Promise(requestAnimationFrame);
  print();
}


// --- Excel: every stored field, one row per project. ---
function exportExcelWorkbook() {
  if (typeof XLSX === 'undefined') {
    adminMessage.textContent = 'The spreadsheet library did not load. Check your connection and retry.';
    adminMessage.className = 'portal-message error';
    return;
  }
  const rows = allProjects.map(project => ({
    'Serial': project.serial_number || '',
    'Project Name': project.project_name || '',
    'Custom Project': project.is_custom ? 'Yes' : 'No',
    'Client Name': project.client_name || '',
    'Client Email': project.client_email || '',
    'Phone': project.phone || '',
    'Company': project.company || '',
    'Account Type': project.client_id ? 'Registered' : 'Guest',
    'Services': servicesOf(project),
    'Video Number': project.project_number || '',
    'Format': project.format || '',
    'Aimed Length': formatLength(project.aimed_length),
    'Color Profile': project.color_profile || '',
    'Preferred Music': project.preferred_music || '',
    'AI Add-On Scenes': project.ai_addon_scenes || 0,
    'AI Add-On Price': Number(project.ai_addon_price || 0),
    'Base Price': Number(project.unit_price || 0),
    'Estimated Total': Number(project.estimated_total || 0),
    'Client Budget': project.client_budget === null || project.client_budget === undefined ? '' : Number(project.client_budget),
    'Status': labelFor(statuses, project.status),
    'Payment Status': labelFor(paymentStatuses, project.payment_status || 'unpaid'),
    'Assigned Editor': project.assigned_editor_name || '',
    'Final Video Link': project.final_video_link || '',
    'Footage Link': project.footage_link || '',
    'Reference Link': project.reference_link || '',
    'Creative notes and Script': project.creative_notes || '',
    'Admin Notes': project.admin_notes || '',
    'Edits Recorded': editsByProject.get(project.id)?.length || 0,
    'Submitted': project.created_at ? new Date(project.created_at).toLocaleString() : '',
    'Last Updated': project.updated_at ? new Date(project.updated_at).toLocaleString() : '',
    'Submission ID': project.submission_id || '',
    'Project ID': project.id
  }));

  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet['!cols'] = Object.keys(rows[0] || { a: '' }).map(key => ({
    wch: Math.min(46, Math.max(12, key.length + 2, ...rows.map(row => String(row[key] ?? '').length).slice(0, 200)))
  }));

  const historyRows = [];
  editsByProject.forEach((edits, projectId) => {
    const project = allProjects.find(item => item.id === projectId);
    edits.forEach(edit => historyRows.push({
      'Serial': project?.serial_number || '',
      'Project Name': project?.project_name || '',
      'Field': fieldLabels[edit.field] || edit.field,
      'Before': edit.old_value ?? '',
      'After': edit.new_value ?? '',
      'Edited By': edit.edited_by_name || '',
      'Role': edit.edited_by_role || '',
      'When': edit.created_at ? new Date(edit.created_at).toLocaleString() : ''
    }));
  });

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Projects');
  if (historyRows.length) XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(historyRows), 'Edit History');
  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(book, `karrar-projects-${stamp}.xlsx`);
  adminMessage.textContent = `Exported ${rows.length} project${rows.length === 1 ? '' : 's'} to Excel.`;
  adminMessage.className = 'portal-message success';
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

function renderPeople() {
  if (!people.length) { editorsList.innerHTML = '<p class="history-empty">No registered accounts yet.</p>'; return; }
  const query = editorsSearch.value.toLowerCase().trim();
  const matches = query
    ? people.filter(person => [person.full_name, person.email, person.role].some(value => String(value || '').toLowerCase().includes(query)))
    : people;
  if (!matches.length) { editorsList.innerHTML = `<p class="history-empty">No one matches “${escapeText(editorsSearch.value.trim())}”.</p>`; return; }
  editorsList.innerHTML = matches.map(person => `<div class="editor-row">
    <div><strong>${escapeText(person.full_name || 'Unnamed')}</strong><span>${escapeText(person.email)}</span></div>
    <span class="role-badge" data-role="${person.role}">${escapeText(person.role)}</span>
    <div class="row-actions">
      ${person.role === 'editor'
        ? `<button class="admin-row-button" type="button" data-set-role="client" data-user="${person.id}">Remove editor</button>`
        : person.role === 'admin'
          ? '<span class="locked-note">Administrator</span>'
          : `<button class="admin-row-button" type="button" data-set-role="editor" data-user="${person.id}">Make editor</button>`}
    </div>
  </div>`).join('');
}

async function loadProjects() {
  const [projectsResult, editsResult, peopleResult] = await Promise.all([
    adminPortal.client.from('projects').select('*').order('serial_number', { ascending: false }),
    adminPortal.client.from('project_edits').select('*').order('created_at', { ascending: false }),
    adminPortal.client.from('profiles').select('id, email, full_name, role').order('full_name')
  ]);
  if (projectsResult.error) {
    adminMessage.textContent = projectsResult.error.message;
    adminMessage.className = 'portal-message error';
    return;
  }
  allProjects = projectsResult.data || [];
  people = peopleResult.data || [];
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
  adminPortal.releaseGate();
  await loadProjects();
})();

search.addEventListener('input', render);
filter.addEventListener('change', render);
clientFilter.addEventListener('change', render);
paymentFilter.addEventListener('change', render);

customToggle.addEventListener('click', () => {
  customOnly = !customOnly;
  customToggle.setAttribute('aria-pressed', String(customOnly));
  customToggle.classList.toggle('active', customOnly);
  customToggle.textContent = customOnly ? '★ Showing All Projects' : '★ Custom Projects';
  customToggle.style.color = '#8b7cff';
  render();
});

document.querySelector('#exportExcel').addEventListener('click', exportExcelWorkbook);
document.querySelector('#exportProjectPdf').addEventListener('click', () => {
  const project = allProjects.find(item => item.id === detailProjectId);
  if (project) exportProjectPdf(project, 'full');
});

document.querySelector('#exportEditorPdf').addEventListener('click', () => {
  const project = allProjects.find(item => item.id === detailProjectId);
  if (project) exportProjectPdf(project, 'editor');
});

document.querySelector('#manageEditors').addEventListener('click', () => {
  editorsMessage.textContent = '';
  editorsSearch.value = '';
  renderPeople();
  editorsDialog.showModal();
});

editorsSearch.addEventListener('input', renderPeople);

editorsList.addEventListener('click', async event => {
  const button = event.target.closest('[data-set-role]');
  if (!button) return;
  editorsMessage.textContent = 'Updating role...';
  editorsMessage.className = 'portal-message';
  const { error } = await adminPortal.client.rpc('set_user_role', { p_user: button.dataset.user, p_role: button.dataset.setRole });
  if (error) {
    editorsMessage.textContent = error.message;
    editorsMessage.className = 'portal-message error';
    return;
  }
  editorsMessage.textContent = 'Role updated.';
  editorsMessage.className = 'portal-message success';
  await loadProjects();
  renderPeople();
});

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
  const editorSelect = event.target.closest('[data-assign-editor]');
  if (!projectSelect && !paymentSelect && !editorSelect) return;

  let id, payload, label;
  if (editorSelect) {
    id = editorSelect.dataset.assignEditor;
    const person = people.find(item => item.id === editorSelect.value);
    payload = { assigned_editor_id: person?.id || null, assigned_editor_name: person ? (person.full_name || person.email) : null };
    label = 'Assigned editor';
  } else {
    const select = projectSelect || paymentSelect;
    id = projectSelect ? select.dataset.projectStatus : select.dataset.paymentStatus;
    payload = { [projectSelect ? 'status' : 'payment_status']: select.value };
    label = projectSelect ? 'Project status' : 'Payment status';
  }

  adminMessage.textContent = `Updating ${label.toLowerCase()}...`;
  adminMessage.className = 'portal-message';
  const { error } = await adminPortal.client.from('projects').update(payload).eq('id', id);
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
editorsDialog.querySelectorAll('[data-close-editors]').forEach(button => button.addEventListener('click', () => editorsDialog.close()));
document.querySelector('[data-signout]').addEventListener('click', () => adminPortal.signOut());
