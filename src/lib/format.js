export function timeAgo(iso) {
  if (!iso) return '';
  const secs = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return 'just now';
  const mins = secs / 60;
  if (mins < 60) return `${Math.floor(mins)}m`;
  const hrs = mins / 60;
  if (hrs < 24) return `${Math.floor(hrs)}h`;
  const days = hrs / 24;
  if (days < 7) return `${Math.floor(days)}d`;
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
}

export function fullDate(iso) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function normalizeUrl(raw) {
  const s = (raw || '').trim();
  if (!s) return '';
  const withScheme = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    if (!u.hostname.includes('.')) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function linkParts(url) {
  try {
    const u = new URL(url);
    const path = (u.pathname + u.search).replace(/\/$/, '');
    return { host: u.hostname.replace(/^www\./, ''), path };
  } catch {
    return { host: url, path: '' };
  }
}

// Split text into plain strings and links so URLs in posts are tappable.
const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,:;"')\]!?])/gi;
export function splitLinks(text) {
  const out = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    out.push({ href: m[0], text: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

export function joinNames(names) {
  if (names.length <= 2) return names.join(' and ');
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

// A journal-style date for posts: "Today, 2:14 pm", "Yesterday, 9:02 am",
// "Wednesday, 8:00 pm" this week, otherwise "Thursday, October 22".
export function entryDate(iso) {
  const d = new Date(iso);
  const now = new Date();
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const days = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }).toLowerCase().replace(/\s/g, ' ');
  if ((now - d) < 60_000) return 'Just now';
  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Yesterday, ${time}`;
  if (days < 7) return `${d.toLocaleDateString(undefined, { weekday: 'long' })}, ${time}`;
  const opts = { weekday: 'long', month: 'long', day: 'numeric' };
  if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString(undefined, opts);
}
