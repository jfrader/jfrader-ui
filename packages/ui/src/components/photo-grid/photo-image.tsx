import { useState } from 'react';
import { vars } from '@jfrader/tokens/vars';
import { css } from '../../styling/css';
import type { PhotoGridPhoto } from './photo-grid';

const imageStyle = css({
  display: 'block', inlineSize: '100%', blockSize: '100%', objectFit: 'cover', borderRadius: 'inherit',
});
const fullImageStyle = css({
  display: 'block', inlineSize: '100%', blockSize: '100%', objectFit: 'contain', userSelect: 'none', pointerEvents: 'none',
});
export const photoFallbackStyle = css({
  padding: vars.space[3], boxSizing: 'border-box', textAlign: 'center', color: vars.color.textMuted, overflowWrap: 'anywhere',
});

export function PhotoImage({ photo, full, meaningful, unavailable }: {
  photo: PhotoGridPhoto;
  full?: boolean;
  meaningful?: boolean;
  unavailable: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed || !photo.src) return (
    <span data-image-state="error" aria-hidden={!full && !meaningful || undefined} title={unavailable} css={photoFallbackStyle}>
      {full ? unavailable : <>▧ {photo.title}</>}
    </span>
  );
  return <img src={photo.src} srcSet={photo.srcSet} sizes={photo.sizes} alt={full || meaningful ? photo.alt : ''}
    width={photo.width} height={photo.height} loading={full ? 'eager' : 'lazy'} decoding="async" draggable={false}
    css={full ? fullImageStyle : imageStyle} onError={() => setFailed(true)} />;
}
