// /api/count — the site's own count of visits. No cookies, no outside service.
//
// POST  records one visit or action. It stores the date, the page, the action and the name of the
//       site the visitor came from. It does not store the IP address or anything else about the visitor.
// GET   returns the totals. Only for someone logged in to the CMS (the same login as /admin).
//
// The counts live in Netlify Blobs, which comes with the Netlify account. Visits to preview versions
// of the site are kept apart from visits to attolloogroup.com.
import { getStore } from '@netlify/blobs';

const EVENTS = new Set([
  'view',              // a page was opened
  'pitch-start',       // the film was started
  'pitch-end',         // the film was watched to the end
  'selftest-start',    // the self-test was started
  'selftest-result',   // the self-test was finished (detail: which result)
  'gates-used',        // someone clicked in "Who has to say yes?"
  'book-click',        // a "Book a Readiness Assessment" link was followed
  'message-sent'       // the contact form was sent (detail: with or without a request for an assessment)
]);

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});
const empty = (status) => new Response(null, { status, headers: { 'cache-control': 'no-store' } });
const clean = (value, pattern) => { const v = String(value || '').toLowerCase(); return pattern.test(v) ? v : ''; };

// The date in Norway, as 2026-10-10
const day = (date) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Oslo' }).format(date);

const isLive = (url) => /(^|\.)attolloogroup\.com$/.test(url.hostname);
const storeFor = (url) => getStore(isLive(url) ? 'counts' : 'counts-preview');

async function record(req, url) {
  const agent = req.headers.get('user-agent') || '';
  if (!agent || /bot|crawl|spider|slurp|headless|lighthouse|monitor|curl|wget|python|scrapy/i.test(agent)) return empty(204);
  // Only the site's own pages count: a request sent from another site is dropped
  const origin = req.headers.get('origin');
  if (origin && origin !== url.origin) return empty(204);
  let body;
  try { body = JSON.parse((await req.text()).slice(0, 400)); } catch (err) { return empty(400); }
  const event = EVENTS.has(body && body.e) ? body.e : '';
  const page = clean(body && body.p, /^[a-z0-9-]{1,40}$/);
  if (!event || !page) return empty(400);
  const detail = clean(body.d, /^[a-z0-9_-]{1,24}$/) || '-';
  const from = clean(body.r, /^[a-z0-9.-]{1,60}$/) || '-';
  // One small entry per visit: nothing is read and written back, so two visits at once cannot lose a count
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  await storeFor(url).set([day(new Date()), event, page, detail, from, id].join('/'), '1');
  return empty(204);
}

async function loggedIn(req, url) {
  const auth = req.headers.get('authorization') || '';
  if (!/^Bearer \S+$/.test(auth)) return false;
  try {
    const res = await fetch(url.origin + '/.netlify/identity/user', { headers: { authorization: auth } });
    return res.ok;
  } catch (err) {
    return false;
  }
}

async function report(req, url) {
  if (!(await loggedIn(req, url))) return json({ error: 'login' }, 401);
  const days = Math.min(120, Math.max(1, parseInt(url.searchParams.get('days'), 10) || 30));
  const now = Date.now();
  const wanted = [];
  for (let i = days - 1; i >= 0; i--) wanted.push(day(new Date(now - i * 86400000)));
  const months = [...new Set(wanted.map((d) => d.slice(0, 7)))];
  const store = storeFor(url);

  const byDay = Object.fromEntries(wanted.map((d) => [d, 0]));
  const byPage = {};
  const events = {};
  const from = {};
  let views = 0;
  for (const month of months) {
    const { blobs } = await store.list({ prefix: month });
    for (const blob of blobs) {
      const [d, event, page, detail, ref] = blob.key.split('/');
      if (!(d in byDay)) continue;
      if (event === 'view') {
        views++;
        byDay[d]++;
        byPage[page] = (byPage[page] || 0) + 1;
        if (ref && ref !== '-') from[ref] = (from[ref] || 0) + 1;
      } else {
        const name = detail && detail !== '-' ? event + ':' + detail : event;
        events[name] = (events[name] || 0) + 1;
      }
    }
  }
  return json({ live: isLive(url), days, first: wanted[0], last: wanted[wanted.length - 1], views, byDay, byPage, events, from });
}

export default async (req) => {
  const url = new URL(req.url);
  if (req.method === 'POST') return record(req, url);
  if (req.method === 'GET') return report(req, url);
  return empty(405);
};

export const config = { path: '/api/count' };
