// Sends a push alert when someone visits or takes a key action on the site.
// Delivery: Telegram (TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID) and/or ntfy (NTFY_TOPIC),
// all set in Vercel → Settings → Environment Variables, so nothing is in the page source.
// Setup helpers (open in a browser):
//   /api/notify          shows what's configured
//   /api/notify?setup    finds your Telegram chat ID after you message the bot
//   /api/notify?test     sends a test alert
const ACTIONS = {
  video_play: ['🎬', 'Played a video'],
  case_study_open: ['📚', 'Opened a case study'],
  resume_download: ['📄', 'Downloaded your résumé'],
  email_click: ['✉️', 'Clicked “Email me”'],
  pdf_open: ['📄', 'Opened a PDF'],
  linkedin_click: ['🔗', 'Clicked LinkedIn'],
};
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|headless|lighthouse|vercel/i;

const env = k => String(process.env[k] || '').trim().replace(/^["']|["']$/g, '').trim();
const tgToken = () => env('TELEGRAM_BOT_TOKEN');
const tgChat = () => env('TELEGRAM_CHAT_ID');
const ntfyTopic = () => env('NTFY_TOPIC').replace(/^https?:\/\/ntfy\.sh\//i, '').replace(/\/+$/, '');

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

// Send one alert to every configured channel; returns a short status per channel
async function send(title, lines, urgent) {
  const out = [];
  if (tgToken() && tgChat()) {
    try {
      const r = await fetch(`https://api.telegram.org/bot${tgToken()}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: tgChat(), text: [title, ...lines].join('\n'), disable_notification: false, disable_web_page_preview: true }),
      });
      const j = await r.json().catch(() => ({}));
      out.push(j.ok ? 'Telegram: sent' : `Telegram: failed (${j.description || r.status})`);
    } catch (e) { out.push('Telegram: could not connect (' + e.message + ')'); }
  }
  if (ntfyTopic()) {
    try {
      const r = await fetch('https://ntfy.sh/', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: ntfyTopic(), title, message: lines.join('\n'), priority: urgent ? 4 : 3, click: 'https://clarity.microsoft.com' }),
      });
      out.push(r.ok ? 'ntfy: sent' : `ntfy: failed (HTTP ${r.status})`);
    } catch (e) { out.push('ntfy: could not connect (' + e.message + ')'); }
  }
  return out;
}

async function setupPage(req, res) {
  const q = req.query || {};
  const text = t => { res.setHeader('Content-Type', 'text/plain; charset=utf-8'); return res.status(200).send(t); };

  if ('setup' in q) {
    if (!tgToken()) return text('Step 1 not done: add TELEGRAM_BOT_TOKEN in Vercel → Settings → Environment Variables, then redeploy.');
    try {
      const j = await (await fetch(`https://api.telegram.org/bot${tgToken()}/getUpdates`)).json();
      if (!j.ok) return text('Telegram rejected the bot token: ' + (j.description || 'unknown error') + '. Check TELEGRAM_BOT_TOKEN.');
      const chats = [...new Map((j.result || []).map(u => u.message || u.my_chat_member || {}).filter(m => m.chat)
        .map(m => [m.chat.id, m.chat])).values()];
      if (!chats.length) return text('No messages found yet. Open your bot in Telegram, tap Start (or send it "hi"), then reload this page.');
      return text('Found your chat. Add this in Vercel as TELEGRAM_CHAT_ID, then redeploy:\n\n' +
        chats.map(c => `${c.id}   (${[c.first_name, c.last_name].filter(Boolean).join(' ') || c.title || c.username || 'chat'})`).join('\n'));
    } catch (e) { return text('Could not reach Telegram: ' + e.message); }
  }
  if ('test' in q) {
    const out = await send('✅ Test from kushswami.com', ['If you can read this, website alerts work.'], true);
    return text(out.length ? out.join('\n') : 'No alert channel is set up yet.');
  }
  const status = [
    tgToken() ? (tgChat() ? 'Telegram: ready' : 'Telegram: bot token set, chat ID missing. Open /api/notify?setup') : 'Telegram: not set up',
    ntfyTopic() ? 'ntfy: ready' : 'ntfy: not set up',
    '', 'Add ?test to this address to send a test alert.',
  ];
  return text(status.join('\n'));
}

module.exports = async (req, res) => {
  if (req.method === 'GET') return setupPage(req, res);
  const ua = req.headers['user-agent'] || '';
  if (req.method !== 'POST' || BOT.test(ua)) return res.status(204).end();

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  const h = req.headers;
  const city = h['x-vercel-ip-city'] ? decodeURIComponent(h['x-vercel-ip-city']) : '';
  const where = [city, h['x-vercel-ip-country-region'], h['x-vercel-ip-country']].filter(Boolean).join(', ') || 'Unknown location';
  const page = clip(body.page, 60) || '/';

  if (body.type === 'action' && ACTIONS[body.action]) {
    const [icon, label] = ACTIONS[body.action];
    await send(`${icon} ${label}`, [body.label ? clip(body.label) : null, `${where} · ${device(ua)}`, `on ${page}`].filter(Boolean), true);
  } else if (body.type === 'visit') {
    await send('👀 New visitor on kushswami.com', [`${where} · ${device(ua)}`, `Landed on ${page}`, body.ref ? `From ${clip(body.ref, 80)}` : 'Direct visit'], false);
  }
  res.status(204).end();
};
