import { useEffect, useState } from 'react';

/** Vehicle photo that falls back to a neutral placeholder if it is missing or fails to load. */
function VehicleImage({ src, alt, lazy = true }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return <div className="image-placeholder" role="img" aria-label={alt || 'No photo available'}>Photo unavailable</div>;
  }
  return <img src={src} alt={alt} loading={lazy ? 'lazy' : undefined} onError={() => setFailed(true)} />;
}

export default VehicleImage;
