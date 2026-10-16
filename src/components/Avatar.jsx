import { useState } from 'react';

// A player's photo from Wikimedia Commons, or their initials when there is none (or it fails to load).
// `photo` is the stored path "ab/File_name.jpg"; Commons serves thumbnails at standard widths.
const COMMONS = 'https://upload.wikimedia.org/wikipedia/commons/';

export function photoUrl(photo, width = 120) {
  if (!photo) return null;
  const i = photo.indexOf('/');
  const dir = photo.slice(0, i);
  const file = encodeURIComponent(photo.slice(i + 1));
  return `${COMMONS}thumb/${dir[0]}/${dir}/${file}/${width}px-${file}`;
}

export const commonsPage = (photo) => `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(photo.slice(photo.indexOf('/') + 1))}`;

const initials = (name = '') => {
  const parts = name.replace(/\([^)]*\)/g, '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
};

export default function Avatar({ photo, name, size = 'sm' }) {
  const [failed, setFailed] = useState(false);
  const src = !failed && photoUrl(photo, size === 'lg' ? 330 : 120);
  return (
    <span className={`avatar avatar-${size}${src ? '' : ' avatar-none'}`} aria-hidden="true">
      {src
        ? <img src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
        : initials(name)}
    </span>
  );
}
