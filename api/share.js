module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { to, title, body, siteUrl } = req.body || {};

  if (!to || !body) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Email service not configured' });
  }

  const siteLink = siteUrl || 'https://task-manager-kappa-tawny.vercel.app';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { margin: 0; padding: 0; background: #0f0f13; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .wrapper { max-width: 560px; margin: 40px auto; padding: 0 20px; }
    .card { background: #1a1a24; border-radius: 12px; overflow: hidden; border: 1px solid #2e2e3e; }
    .card-header { padding: 24px 28px; border-bottom: 1px solid #2e2e3e; }
    .app-name { font-size: 13px; font-weight: 600; color: #7c6ef7; letter-spacing: 0.08em; text-transform: uppercase; margin: 0 0 6px; }
    .tagline { font-size: 20px; font-weight: 600; color: #e8e8f0; margin: 0; }
    .card-body { padding: 28px; }
    .note-title { font-size: 17px; font-weight: 600; color: #e8e8f0; margin: 0 0 12px; }
    .note-body { font-size: 15px; line-height: 1.65; color: #b8b8cc; white-space: pre-wrap; margin: 0; }
    .card-footer { padding: 20px 28px; border-top: 1px solid #2e2e3e; text-align: center; }
    .btn { display: inline-block; background: #7c6ef7; color: #ffffff; text-decoration: none; padding: 11px 24px; border-radius: 8px; font-size: 14px; font-weight: 500; }
    .meta { margin-top: 24px; text-align: center; font-size: 12px; color: #555566; }
    .meta a { color: #7c6ef7; text-decoration: none; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="card-header">
        <p class="app-name">Task Manager</p>
        <h1 class="tagline">Someone shared a note with you</h1>
      </div>
      <div class="card-body">
        ${title ? `<h2 class="note-title">${escHtml(title)}</h2>` : ''}
        <p class="note-body">${escHtml(body)}</p>
      </div>
      <div class="card-footer">
        <a href="${siteLink}" class="btn">View all notes &rarr;</a>
      </div>
    </div>
    <p class="meta">Sent via <a href="${siteLink}">Task Manager</a></p>
  </div>
</body>
</html>`;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Task Manager <onboarding@resend.dev>',
        to: [to],
        subject: title ? `Note: ${title}` : 'A note was shared with you',
        html,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.message || 'Failed to send email' });
    }

    res.status(200).json({ success: true, id: data.id });
  } catch {
    res.status(500).json({ error: 'Failed to send email' });
  }
};

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
