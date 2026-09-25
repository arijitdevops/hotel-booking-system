import { useState, type JSX } from 'react';

interface ThumbnailProps {
  src: string | null;
  alt: string;
  className?: string;
}

/**
 * Image with a graceful fallback.
 *
 * The sample data points at `/images/...` placeholders that are not committed
 * to the repository, so a missing file renders a tinted panel with the initial
 * instead of a broken image icon.
 */
export function Thumbnail({ src, alt, className }: ThumbnailProps): JSX.Element {
  const [failed, setFailed] = useState(false);
  const classes = className ? `thumbnail ${className}` : 'thumbnail';

  if (!src || failed) {
    return (
      <div className={`${classes} thumbnail--placeholder`} role="img" aria-label={alt}>
        <span aria-hidden="true">{alt.charAt(0).toUpperCase()}</span>
      </div>
    );
  }

  return (
    <img
      className={classes}
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
