// Hearts on the same post (or the same comment) become one line, shown at
// the time of the newest heart. Everything else stays one line per event.
export function groupActivity(list) {
  const out = [];
  const byKey = new Map();
  for (const item of list) {
    const key = item.kind === 'heart_post' ? `hp:${item.post_id}`
      : item.kind === 'heart_comment' ? `hc:${item.post_id}:${item.snippet}` : null;
    if (key && byKey.has(key)) {
      const g = byKey.get(key);
      if (!g.names.includes(item.actor_name)) g.names.push(item.actor_name);
      continue;
    }
    const g = { ...item, names: [item.actor_name] };
    if (key) byKey.set(key, g);
    out.push(g);
  }
  return out;
}

