// Shrinks photos on the phone before upload. A typical 4 MB phone photo
// becomes ~250 KB, which is what keeps Peaches inside the free storage tier.

async function loadBitmap(file) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch { /* fall through */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export async function compressImage(file, { maxSize = 1600, square = false, quality = 0.82 } = {}) {
  const bmp = await loadBitmap(file);
  const w = bmp.width, h = bmp.height;
  let sx = 0, sy = 0, sw = w, sh = h;
  if (square) {
    const side = Math.min(w, h);
    sx = (w - side) / 2; sy = (h - side) / 2; sw = sh = side;
  }
  const scale = Math.min(1, maxSize / Math.max(sw, sh));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
  if (!blob) throw new Error('Couldn’t read that photo. Try a JPEG or PNG.');
  return blob;
}

// Like compressImage, but also reports the photo's shape (width ÷ height),
// which lets a row of photos be laid out before they finish loading.
export async function compressPhoto(file) {
  const blob = await compressImage(file);
  let ratio = null;
  try {
    const bmp = await createImageBitmap(blob);
    ratio = Math.round((bmp.width / bmp.height) * 1000) / 1000;
  } catch { /* shape unknown; the app will measure it on load */ }
  return { blob, ratio };
}
