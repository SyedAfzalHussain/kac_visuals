// Emails an assigned editor their project brief.
//
// The caller must present a Supabase access token belonging to an admin. The
// project row and the editor's address are read with that same token, so this
// endpoint holds no Supabase service key — the only secret it needs is the mail
// provider's. Set these in Vercel > Project > Settings > Environment Variables:
//
//   RESEND_API_KEY   required — from resend.com
//   MAIL_FROM        e.g. "Karrar Enterprises <projects@karrarenterprisesllc.com>"
//   SITE_URL         defaults to the production domain

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bgsqpmckltxofzntgpll.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_KlaK2MdHleZaiI603zOa6w_l-4IiWMJ';
const SITE_URL = process.env.SITE_URL || 'https://www.karrarenterprisesllc.com';

// Brief columns only — deliberately the same set the editor's own view exposes.
const BRIEF_COLUMNS = [
  'id', 'serial_number', 'project_name', 'service_name', 'project_number', 'format',
  'aimed_length', 'color_profile', 'preferred_music', 'ai_addon_scenes', 'footage_link',
  'reference_link', 'creative_notes', 'priority', 'assigned_editor_id', 'assigned_editor_name'
].join(',');

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatLength(seconds) {
  const total = Number(seconds) || 0;
  if (!total) return 'Not provided';
  if (total < 60) return `${total}s`;
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return rest ? `${minutes}m ${rest}s` : `${minutes} min`;
}

function serial(project) {
  return project.serial_number ? `#${String(project.serial_number).padStart(3, '0')}` : '—';
}

function safeLink(value) {
  if (!value) return '';
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}

async function supabaseGet(path, token) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` }
  });
  if (!response.ok) return null;
  return response.json();
}

function buildEmail(project, editorName) {
  const rows = [
    ['Serial number', serial(project)],
    ['Service', project.service_name || 'Not provided'],
    ['Video number', String(project.project_number || 1).padStart(2, '0')],
    ['Priority', (project.priority || 'normal').replace(/^./, c => c.toUpperCase())],
    ['Format', project.format || 'Not provided'],
    ['Aimed length', formatLength(project.aimed_length)],
    ['Color profile', project.color_profile || 'Not provided'],
    ['Preferred music', project.preferred_music || 'Not provided'],
    ['AI add-on', project.ai_addon_scenes
      ? `${project.ai_addon_scenes} scene${project.ai_addon_scenes === 1 ? '' : 's'}`
      : 'Off']
  ];

  const linkRow = (label, value) => {
    const url = safeLink(value);
    return url
      ? `<tr><td style="padding:8px 0;color:#777;font-size:12px;width:170px">${escapeHtml(label)}</td><td style="padding:8px 0"><a href="${escapeHtml(url)}" style="color:#7564f8">${escapeHtml(value)}</a></td></tr>`
      : `<tr><td style="padding:8px 0;color:#777;font-size:12px;width:170px">${escapeHtml(label)}</td><td style="padding:8px 0;color:#111">Not provided</td></tr>`;
  };

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#111">
    <p style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#7564f8;margin:0 0 6px">New Assignment</p>
    <h1 style="font-size:22px;margin:0 0 4px">${escapeHtml(project.project_name)}</h1>
    <p style="color:#777;font-size:13px;margin:0 0 22px">${escapeHtml(serial(project))} · assigned to ${escapeHtml(editorName)}</p>
    <table style="width:100%;border-collapse:collapse;border-top:1px solid #e5e5e5">
      ${rows.map(([label, value]) => `<tr><td style="padding:8px 0;color:#777;font-size:12px;width:170px">${escapeHtml(label)}</td><td style="padding:8px 0;color:#111">${escapeHtml(value)}</td></tr>`).join('')}
      ${linkRow('Footage / project files', project.footage_link)}
      ${linkRow('Reference video', project.reference_link)}
    </table>
    <h2 style="font-size:14px;margin:26px 0 8px">Creative notes and Script</h2>
    <p style="white-space:pre-wrap;line-height:1.7;font-size:13px;border:1px solid #e5e5e5;padding:14px;margin:0">${escapeHtml(project.creative_notes || 'Not provided')}</p>
    <p style="margin:26px 0 0"><a href="${SITE_URL}/editor" style="display:inline-block;background:#7564f8;color:#fff;padding:12px 22px;text-decoration:none;font-size:13px">Open your editor dashboard</a></p>
    <p style="color:#999;font-size:11px;margin-top:26px;border-top:1px solid #e5e5e5;padding-top:14px">Karrar Enterprises LLC · this brief is confidential and for the assigned editor only.</p>
  </div>`;

  const text = [
    `New assignment: ${project.project_name} (${serial(project)})`,
    '',
    ...rows.map(([label, value]) => `${label}: ${value}`),
    `Footage / project files: ${project.footage_link || 'Not provided'}`,
    `Reference video: ${project.reference_link || 'Not provided'}`,
    '',
    'Creative notes and Script:',
    project.creative_notes || 'Not provided',
    '',
    `${SITE_URL}/editor`
  ].join('\n');

  return { html, text, subject: `New assignment ${serial(project)} · ${project.project_name}` };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Use POST.' });
  }
  if (!process.env.RESEND_API_KEY) {
    return res.status(503).json({ error: 'Email is not configured yet — add RESEND_API_KEY in Vercel.' });
  }

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Sign in again.' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const projectId = String(body.projectId || '');
  if (!/^[0-9a-f-]{36}$/i.test(projectId)) return res.status(400).json({ error: 'A project id is required.' });

  // Who is calling, and are they an admin?
  const account = await supabaseGet('/auth/v1/user', token);
  if (!account?.id) return res.status(401).json({ error: 'Your session has expired — sign in again.' });

  const [caller] = await supabaseGet(`/rest/v1/profiles?select=role&id=eq.${account.id}`, token) || [];
  if (caller?.role !== 'admin') return res.status(403).json({ error: 'Only an administrator can send a brief.' });

  const [project] = await supabaseGet(`/rest/v1/projects?select=${BRIEF_COLUMNS}&id=eq.${projectId}`, token) || [];
  if (!project) return res.status(404).json({ error: 'That project no longer exists.' });
  if (!project.assigned_editor_id) return res.status(400).json({ error: 'Assign an editor before sending the brief.' });

  const [editor] = await supabaseGet(`/rest/v1/profiles?select=email,full_name&id=eq.${project.assigned_editor_id}`, token) || [];
  if (!editor?.email) return res.status(404).json({ error: 'That editor has no email address on file.' });

  const { subject, html, text } = buildEmail(project, editor.full_name || editor.email);
  const sent = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: process.env.MAIL_FROM || 'Karrar Enterprises <onboarding@resend.dev>',
      to: [editor.email],
      subject,
      html,
      text
    })
  });

  if (!sent.ok) {
    const detail = await sent.text();
    return res.status(502).json({ error: `The mail provider rejected the message: ${detail.slice(0, 300)}` });
  }

  return res.status(200).json({ ok: true, to: editor.email });
};
