import React, { useEffect, useMemo, useState } from 'react';
import { FiX, FiChevronLeft, FiChevronRight, FiDownload, FiFile, FiExternalLink } from 'react-icons/fi';
import { resolveApiUrl } from '../utils/constants';

export interface DiaryImageItem {
  kind?: 'image' | 'file';
  url: string;
  thumb_url?: string;
  w?: number;
  h?: number;
  size?: number;
  original_name?: string;
  mime?: string;
  ext?: string;
}

interface Props {
  images: DiaryImageItem[];
  /** Optional compact rendering (smaller thumbs, no captions). */
  compact?: boolean;
  /** Entry date (ISO YYYY-MM-DD). Used to build a clean download filename. */
  entryDate?: string;
  /** Subject name for the same purpose. */
  subjectName?: string;
}

const prettyBytes = (n?: number) => {
  if (!n || n <= 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

const isImage = (it: DiaryImageItem) =>
  it.kind === 'image' || (!it.kind && (!!it.thumb_url || /\.(jpe?g|png|webp|gif)$/i.test(it.url)));

const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

/** Lowercase, hyphenate, strip everything that isn't alnum/hyphen. */
const slug = (s?: string, max = 50) =>
  (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max);

/**
 * Build a clean download filename like `8jun2026-english-worksheet-chapter5.pdf`
 * from the entry context + the original filename. Falls back gracefully if
 * any piece is missing.
 */
export function buildDownloadName(opts: {
  entryDate?: string;
  subjectName?: string;
  originalName?: string;
  ext?: string;
  urlFallback?: string;
}): string {
  let datePart = '';
  if (opts.entryDate) {
    const d = new Date(opts.entryDate + 'T00:00:00');
    if (!isNaN(d.getTime())) {
      datePart = `${d.getDate()}${MONTHS[d.getMonth()]}${d.getFullYear()}`;
    }
  }
  const subj = slug(opts.subjectName, 30);
  // Strip extension from original name so we don't double-up "foo.pdf.pdf"
  const baseName = (opts.originalName || '').replace(/\.[^./\\]+$/, '');
  const namePart = slug(baseName, 50);

  // Resolve extension: explicit ext > extension in original_name > extension
  // in the URL > nothing.
  let ext = (opts.ext || '').toLowerCase().replace(/^\./, '');
  if (!ext) ext = ((opts.originalName || '').match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase();
  if (!ext) ext = ((opts.urlFallback || '').match(/\.([a-z0-9]+)(?:\?|#|$)/i)?.[1] || '').toLowerCase();

  const stem = [datePart, subj, namePart].filter(Boolean).join('-') || 'attachment';
  return ext ? `${stem}.${ext}` : stem;
}

/** Append `?name=<formatted>` to a same-host URL. */
function withDownloadName(url: string, name: string): string {
  if (!url) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}name=${encodeURIComponent(name)}`;
}

/**
 * Tap a thumb → fullscreen lightbox with prev/next + Esc to close.
 */
export default function DiaryImageGrid({ images, compact, entryDate, subjectName }: Props) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  // Lightbox navigates only between IMAGE entries; files open in a new tab.
  const imageItems = useMemo(() => images.filter(isImage), [images]);
  const fileItems  = useMemo(() => images.filter(it => !isImage(it)), [images]);

  useEffect(() => {
    if (openIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenIdx(null);
      if (e.key === 'ArrowLeft') setOpenIdx(i => (i === null ? null : Math.max(0, i - 1)));
      if (e.key === 'ArrowRight') setOpenIdx(i => (i === null ? null : Math.min(imageItems.length - 1, i + 1)));
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [openIdx, imageItems.length]);

  if (!images || images.length === 0) return null;

  return (
    <>
      {imageItems.length > 0 && (
        <div className={`diary-image-grid ${compact ? 'compact' : ''}`}>
          {imageItems.map((img, i) => (
            <button
              key={img.url}
              type="button"
              className="diary-image-tile"
              onClick={() => setOpenIdx(i)}
              aria-label={img.original_name || `Image ${i + 1}`}
              style={{
                aspectRatio: img.w && img.h ? `${img.w} / ${img.h}` : '1 / 1',
              }}
            >
              <img
                src={resolveApiUrl(img.thumb_url || img.url)}
                alt={img.original_name || `Image ${i + 1}`}
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}

      {fileItems.length > 0 && (
        <div className={`diary-file-list ${compact ? 'compact' : ''}`}>
          {fileItems.map((f, i) => {
            const dlName = buildDownloadName({
              entryDate, subjectName,
              originalName: f.original_name,
              ext: f.ext,
              urlFallback: f.url,
            });
            const href = withDownloadName(resolveApiUrl(f.url), dlName);
            return (
              <a
                key={f.url}
                href={href}
                // Same-origin browsers honour this; cross-origin relies on the
                // server's Content-Disposition (which we set from ?name=).
                download={dlName}
                rel="noreferrer"
                className={`diary-file-card ext-${(f.ext || 'doc')}`}
                title={`Download as ${dlName}`}
              >
                <div className={`diary-file-icon ext-${(f.ext || 'doc')}`}>
                  <FiFile />
                  <span className="diary-file-ext">{(f.ext || 'FILE').toUpperCase()}</span>
                </div>
                <div className="diary-file-meta">
                  <div className="diary-file-name">{f.original_name || `Document ${i + 1}`}</div>
                  <div className="diary-file-size">
                    {prettyBytes(f.size)}{f.size ? ' · ' : ''}tap to download
                  </div>
                </div>
                <FiExternalLink className="diary-file-open" />
              </a>
            );
          })}
        </div>
      )}

      {openIdx !== null && imageItems[openIdx] && (
        <div className="diary-lightbox" onClick={() => setOpenIdx(null)} role="dialog" aria-modal="true">
          <button
            type="button"
            className="diary-lightbox-btn close"
            onClick={(e) => { e.stopPropagation(); setOpenIdx(null); }}
            aria-label="Close"
          >
            <FiX />
          </button>
          {openIdx > 0 && (
            <button
              type="button"
              className="diary-lightbox-btn prev"
              onClick={(e) => { e.stopPropagation(); setOpenIdx(openIdx - 1); }}
              aria-label="Previous"
            >
              <FiChevronLeft />
            </button>
          )}
          {openIdx < imageItems.length - 1 && (
            <button
              type="button"
              className="diary-lightbox-btn next"
              onClick={(e) => { e.stopPropagation(); setOpenIdx(openIdx + 1); }}
              aria-label="Next"
            >
              <FiChevronRight />
            </button>
          )}
          {(() => {
            const cur = imageItems[openIdx];
            const dlName = buildDownloadName({
              entryDate, subjectName,
              originalName: cur.original_name,
              ext: cur.ext,
              urlFallback: cur.url,
            });
            const href = withDownloadName(resolveApiUrl(cur.url), dlName);
            return (
              <a
                href={href}
                download={dlName}
                rel="noreferrer"
                className="diary-lightbox-btn download"
                onClick={(e) => e.stopPropagation()}
                aria-label="Download"
                title={`Download as ${dlName}`}
              >
                <FiDownload />
              </a>
            );
          })()}
          <img
            src={resolveApiUrl(imageItems[openIdx].url)}
            alt={imageItems[openIdx].original_name || `Image ${openIdx + 1}`}
            className="diary-lightbox-img"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="diary-lightbox-counter">{openIdx + 1} / {imageItems.length}</div>
        </div>
      )}
    </>
  );
}
