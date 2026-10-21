// Sends a push notification via ntfy.sh when someone visits or takes a key action.
// The topic lives in the NTFY_TOPIC environment variable (Vercel → Settings →
// Environment Variables) so it never appears in the page source.
const ACTIONS = {
  video_play: ['Played a video', 'clapper'],
  case_study_open: ['Opened a case study', 'books'],
  resume_download: ['Downloaded your résumé', 'page_facing_up'],
  email_click: ['Clicked “Email me”', 'email'],
  pdf_open: ['Opened a PDF', 'page_facing_up'],
  linkedin_click: ['Clicked LinkedIn', 'link'],
};
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|headless|lighthouse|vercel/i;

function device(ua) {
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? 'Android phone' : 'Android tablet';
  if (/Macintosh/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows PC';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Unknown device';
}
const clip = (v, n = 120) => String(v || '').replace(/[\r\n]+/g, ' ').slice(0, n);

module.exports = async (req, res) => {
  const topic = process.env.NTFY_TOPIC;
  const ua = req.headers['user-agent'] || '';
  // Opening /api/notify in a browser shows whether alerts are set up (without revealing the topic)
  if (req.method === 'GET') {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(200).send(topic ? 'Alerts ready: NTFY_TOPIC is set.' : 'Alerts NOT ready: NTFY_TOPIC is missing. Add it in Vercel → Settings → Environment Variables, then redeploy.');
  }
  if (req.method !== 'POST' || !topic || BOT.test(ua)) return res.status(204).end();

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  const h = req.headers;
  const city = h['x-vercel-ip-city'] ? decodeURIComponent(h['x-vercel-ip-city']) : '';
  const where = [city, h['x-vercel-ip-country-region'], h['x-vercel-ip-country']].filter(Boolean).join(', ') || 'Unknown location';
  const page = clip(body.page, 60) || '/';

  let title, tags, priority = '3', lines;
  if (body.type === 'action' && ACTIONS[body.action]) {
    const [label, tag] = ACTIONS[body.action];
    title = label; tags = tag; priority = '4';
    lines = [body.label ? clip(body.label) : null, `${where} · ${device(ua)}`, `on ${page}`];
  } else if (body.type === 'visit') {
    title = 'New visitor on kushswami.com'; tags = 'eyes';
    lines = [`${where} · ${device(ua)}`, `Landed on ${page}`, body.ref ? `From ${clip(body.ref, 80)}` : 'Direct visit'];
  } else {
    return res.status(204).end();
  }

  try {
    await fetch('https://ntfy.sh/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic, title, tags: [tags], priority: +priority,
        message: lines.filter(Boolean).join('\n'),
        click: 'https://clarity.microsoft.com',
      }),
    });
  } catch {}
  res.status(204).end();
};
