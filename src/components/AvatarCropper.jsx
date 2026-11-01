import { useCallback, useState } from 'react';
import Cropper from 'react-easy-crop';
import { Sheet } from './ui.jsx';

// Position and zoom a new profile photo inside the round frame.
// Drag to move; pinch, scroll or use the slider to zoom.
export function AvatarCropper({ src, onCancel, onDone }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const onComplete = useCallback((_, pixels) => setArea(pixels), []);

  async function finish() {
    if (!area) return;
    setBusy(true);
    try {
      onDone(await cropToBlob(src, area));
    } catch (e) {
      setError(e.message); setBusy(false);
    }
  }

  return (
    <Sheet title="Move and zoom" onClose={onCancel}
      footer={
        <>
          <button className="text-btn" onClick={onCancel}>Cancel</button>
          <span className="spacer" />
          <button className="gel-btn" disabled={!area || busy} onClick={finish}>{busy ? 'One moment…' : 'Use photo'}</button>
        </>
      }>
      <div className="cropper-box">
        <Cropper image={src} crop={crop} zoom={zoom} aspect={1} cropShape="round" showGrid={false}
          minZoom={1} maxZoom={4} zoomSpeed={0.4} objectFit="cover"
          onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onComplete} />
      </div>
      <label className="zoom-row">
        <span aria-hidden="true" className="zoom-small">−</span>
        <input type="range" min={1} max={4} step={0.01} value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))} aria-label="Zoom" />
        <span aria-hidden="true" className="zoom-big">+</span>
      </label>
      {error && <p className="error-note" role="alert">{error}</p>}
    </Sheet>
  );
}

// Cuts the chosen square out of the photo at 480 × 480.
async function cropToBlob(src, area) {
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('Couldn’t read that photo. Try a JPEG or PNG.'));
    i.src = src;
  });
  const size = Math.min(480, Math.round(area.width));
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, size, size);
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.88));
  if (!blob) throw new Error('Couldn’t read that photo. Try a JPEG or PNG.');
  return blob;
}
