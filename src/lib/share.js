// Sharing a post outward sends a copy (text, link, photo), not a Peachey
// link: Peachey is private, so a link would only reach a sign-in screen.

export function shareText(post, authorName, isMine) {
  const parts = [];
  if (post.body) parts.push(post.body);
  if (post.link_url && !post.body?.includes(post.link_url)) parts.push(post.link_url);
  if (!isMine && authorName) parts.push(`— ${authorName}`);
  return parts.join('\n\n');
}

async function photoFile(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith('image/') || blob.type === 'image/svg+xml') return null;
    const ext = blob.type.split('/')[1] === 'png' ? 'png' : 'jpg';
    return new File([blob], `peachey-photo.${ext}`, { type: blob.type });
  } catch {
    return null;
  }
}

// Opens the device's share sheet. Returns 'shared', 'cancelled', or
// 'unsupported' (no share sheet here, so the caller shows copy/open options).
export async function sharePost(post, authorName, isMine) {
  if (!navigator.share) return 'unsupported';
  const text = shareText(post, authorName, isMine);
  const data = { text };
  if (post.image_url) {
    const file = await photoFile(post.image_url);
    if (file && navigator.canShare?.({ files: [file] })) data.files = [file];
  }
  try {
    await navigator.share(data);
    return 'shared';
  } catch (e) {
    if (e?.name === 'AbortError') return 'cancelled';
    // Some browsers refuse files or refuse share entirely; try text alone once.
    if (data.files) {
      try { await navigator.share({ text }); return 'shared'; } catch (e2) {
        if (e2?.name === 'AbortError') return 'cancelled';
      }
    }
    return 'unsupported';
  }
}
