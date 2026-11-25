import { useRef, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from './auth';
import { Notice, useNotice } from './ui';

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const DOWNSCALE_ABOVE_BYTES = 3 * 1024 * 1024;
const DOWNSCALE_MAX_SIDE = 2560;

/**
 * Large camera photos are downscaled in the browser before upload. The server
 * re-encodes to 1920px WebP anyway, so nothing visible is lost, uploads are
 * much faster, and requests stay under serverless body-size limits.
 */
async function prepare(file) {
  if (file.size <= DOWNSCALE_ABOVE_BYTES || typeof createImageBitmap !== 'function') return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, DOWNSCALE_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    return blob && blob.size < file.size ? new File([blob], 'photo.jpg', { type: 'image/jpeg' }) : file;
  } catch {
    return file;
  }
}

function ImageManager({ vehicle, onChange }) {
  const { guard } = useAuth();
  const notice = useNotice();
  const fileInput = useRef(null);
  const [progress, setProgress] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [url, setUrl] = useState('');
  const images = vehicle.images;

  const run = async (work, successMessage) => {
    setBusy(true);
    try {
      onChange(await work());
      if (successMessage) notice.success(successMessage);
    } catch (failure) {
      guard(failure);
      notice.error(failure);
    } finally {
      setBusy(false);
    }
  };

  const upload = async (fileList) => {
    const files = Array.from(fileList).filter((file) => ACCEPTED.includes(file.type));
    const skipped = fileList.length - files.length;
    if (!files.length) {
      notice.error('Please choose JPEG, PNG or WebP images.');
      return;
    }
    setBusy(true);
    notice.clear();
    let uploaded = 0;
    let failure = null;
    // One request per photo: clear progress, and each stays small.
    for (const [index, file] of files.entries()) {
      setProgress({ current: index + 1, total: files.length });
      try {
        const body = new FormData();
        body.append('images', await prepare(file), file.name);
        onChange(await api.post(`/admin/vehicles/${vehicle.id}/images`, body));
        uploaded += 1;
      } catch (error) {
        guard(error);
        failure = error;
        break;
      }
    }
    setProgress(null);
    setBusy(false);
    if (fileInput.current) fileInput.current.value = '';
    if (failure) notice.error(`${uploaded} of ${files.length} photo(s) uploaded. ${failure.message}`);
    else notice.success(`${uploaded} photo(s) uploaded.${skipped ? ` ${skipped} unsupported file(s) skipped.` : ''}`);
  };

  const move = (index, direction) => {
    const order = images.map((image) => image.id);
    const target = index + direction;
    [order[index], order[target]] = [order[target], order[index]];
    run(() => api.put(`/admin/vehicles/${vehicle.id}/images/order`, { imageIds: order }));
  };

  const addUrl = (event) => {
    event.preventDefault();
    run(async () => {
      const result = await api.post(`/admin/vehicles/${vehicle.id}/images/url`, { url: url.trim() });
      setUrl('');
      return result;
    }, 'Image added.');
  };

  return (
    <section className="admin-form image-manager" aria-labelledby="photos-heading">
      <fieldset>
        <legend id="photos-heading">Photos ({images.length})</legend>
        <Notice notice={notice.notice} />

        <div
          className={`dropzone ${dragging ? 'dragging' : ''}`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (!busy && event.dataTransfer.files.length) upload(event.dataTransfer.files);
          }}
        >
          <p>{progress ? `Uploading photo ${progress.current} of ${progress.total}…` : 'Drag photos here, or'}</p>
          <label className={`submit-btn link-btn ${busy ? 'disabled' : ''}`} htmlFor="photo-input">Choose Photos</label>
          <input id="photo-input" ref={fileInput} className="sr-only" type="file" multiple disabled={busy}
            accept={ACCEPTED.join(',')} onChange={(event) => event.target.files.length && upload(event.target.files)} />
          <p className="admin-hint">JPEG, PNG or WebP. Photos are optimised automatically. The primary photo is the one shown on inventory cards.</p>
        </div>

        {images.length ? (
          <ul className="image-grid">
            {images.map((image, index) => (
              <li key={image.id} className={image.isPrimary ? 'primary' : ''}>
                <img src={image.thumbUrl} alt={`${vehicle.title}, view ${index + 1}`} loading="lazy" />
                {image.isPrimary ? <span className="primary-tag">Primary</span> : null}
                <div className="image-actions">
                  {!image.isPrimary ? (
                    <button type="button" className="small-btn" disabled={busy}
                      onClick={() => run(() => api.patch(`/admin/images/${image.id}`, { isPrimary: true }), 'Primary photo updated.')}>
                      Set primary
                    </button>
                  ) : null}
                  <button type="button" className="small-btn" disabled={busy || index === 0}
                    aria-label={`Move photo ${index + 1} earlier`} onClick={() => move(index, -1)}>←</button>
                  <button type="button" className="small-btn" disabled={busy || index === images.length - 1}
                    aria-label={`Move photo ${index + 1} later`} onClick={() => move(index, 1)}>→</button>
                  <button type="button" className="small-btn danger" disabled={busy}
                    onClick={() => window.confirm('Delete this photo?')
                      && run(() => api.delete(`/admin/images/${image.id}`), 'Photo deleted.')}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="admin-muted">No photos yet. Vehicles without photos show a placeholder on the website.</p>
        )}

        <form className="inline-form" onSubmit={addUrl}>
          <label htmlFor="image-url">Or add a photo by web address</label>
          <div className="inline-row">
            <input id="image-url" type="url" placeholder="https://…" required value={url}
              onChange={(event) => setUrl(event.target.value)} />
            <button type="submit" className="small-btn" disabled={busy}>Add</button>
          </div>
        </form>
      </fieldset>
    </section>
  );
}

export default ImageManager;
