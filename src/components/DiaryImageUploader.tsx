import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FiImage, FiCamera, FiTrash2, FiX, FiUploadCloud,
  FiAlertCircle, FiCheck,
} from 'react-icons/fi';
import client from '../api/client';
import { resolveApiUrl } from '../utils/constants';

/**
 * One uploaded (or pending) attachment. Polymorphic: images carry w/h/thumb_url,
 * documents carry mime/ext and are rendered as cards.
 */
export interface DiaryAttachment {
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

interface PendingItem {
  /** local id so React keys are stable while we wait on the upload */
  id: string;
  /** object URL for instant preview (only for images) */
  previewUrl: string;
  /** what we're uploading — for icon vs thumbnail rendering */
  kind: 'image' | 'file';
  /** filename to show on the placeholder card */
  displayName: string;
  /** extension for the icon colour */
  ext: string;
  /** byte size from the File object */
  size: number;
  /** 0-100 */
  progress: number;
  /** "resizing" before upload starts, "uploading" once bytes are flying */
  phase: 'queued' | 'resizing' | 'uploading';
  /** filled in once the server responds */
  attachment?: DiaryAttachment;
  /** human-readable error if upload fails */
  error?: string;
}

interface Props {
  value: DiaryAttachment[];
  onChange: (next: DiaryAttachment[]) => void;
  /** Hard cap on total images per entry (UX guardrail, not a security thing). */
  max?: number;
  /** Disable interaction (e.g. while parent form is saving). */
  disabled?: boolean;
}

const MAX_CLIENT_LONG_EDGE = 1600;   // pre-shrink before upload
const CLIENT_JPEG_QUALITY = 0.85;
const HARD_IMG_BYTE_CAP = 10 * 1024 * 1024;
const VALID_IMG_TYPES = /^image\/(jpeg|jpg|png|webp|gif)$/i;

// Documents — keep in sync with the backend FILE_RULES table.
const FILE_LIMITS: Record<string, number> = {
  pdf:  25 * 1024 * 1024,
  doc:  15 * 1024 * 1024,
  docx: 15 * 1024 * 1024,
  xls:  15 * 1024 * 1024,
  xlsx: 15 * 1024 * 1024,
  ppt:  25 * 1024 * 1024,
  pptx: 25 * 1024 * 1024,
};
const FILE_EXTS = Object.keys(FILE_LIMITS);
const VALID_FILE_EXT = new RegExp(`\\.(${FILE_EXTS.join('|')})$`, 'i');

const extOf = (f: File) => (f.name.split('.').pop() || '').toLowerCase();
const isImage = (f: File) => VALID_IMG_TYPES.test(f.type) || /^image\//.test(f.type);
const isDoc = (f: File) => FILE_EXTS.includes(extOf(f));

const prettyBytes = (n?: number) => {
  if (!n || n <= 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

/** Yield to the browser so it can paint the pending thumbnails before we start
 *  blocking the main thread on canvas work. Double rAF guarantees one full frame.
 */
const yieldToPaint = () =>
  new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));

/**
 * Resize an image File to fit MAX_CLIENT_LONG_EDGE on its longest side and
 * re-encode as JPEG, dropping EXIF. Uses the modern `createImageBitmap` API
 * which decodes off the main thread (5–10× faster than FileReader+Image),
 * and `OffscreenCanvas` when available so the resize itself doesn't block.
 * Keeps GIFs untouched (animation would break on canvas re-encode).
 */
async function shrinkImage(file: File): Promise<Blob> {
  if (file.type === 'image/gif' || file.size < 300 * 1024) {
    return file; // tiny or animated — skip the canvas dance
  }

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file; // ancient browser — let the server handle the downscale
  }

  try {
    const longest = Math.max(bitmap.width, bitmap.height);
    if (longest <= MAX_CLIENT_LONG_EDGE) return file;

    const scale = MAX_CLIENT_LONG_EDGE / longest;
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);

    // Prefer OffscreenCanvas — runs off the main thread, no UI stutter.
    if (typeof OffscreenCanvas !== 'undefined') {
      const off = new OffscreenCanvas(w, h);
      const ctx = off.getContext('2d');
      if (!ctx) return file;
      ctx.drawImage(bitmap, 0, 0, w, h);
      return await off.convertToBlob({ type: 'image/jpeg', quality: CLIENT_JPEG_QUALITY });
    }

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    return await new Promise<Blob>(res => {
      canvas.toBlob(
        b => res(b || file),
        'image/jpeg',
        CLIENT_JPEG_QUALITY,
      );
    });
  } finally {
    // Release decoded pixel buffer regardless of which branch ran.
    bitmap?.close?.();
  }
}

export default function DiaryImageUploader({
  value, onChange, max = 8, disabled,
}: Props) {
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Clean up object URLs when items are removed
  useEffect(() => {
    return () => {
      pending.forEach(p => { try { URL.revokeObjectURL(p.previewUrl); } catch {} });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const uploadOne = useCallback(async (file: File, slotId: string) => {
    const asImage = isImage(file);
    const asDoc = !asImage && isDoc(file);
    if (!asImage && !asDoc) {
      setPending(prev => prev.map(p => p.id === slotId ? { ...p, error: 'Unsupported file type' } : p));
      return null;
    }

    if (asImage && file.size > HARD_IMG_BYTE_CAP) {
      setPending(prev => prev.map(p => p.id === slotId ? { ...p, error: 'Image too big (10 MB max)' } : p));
      return null;
    }
    if (asDoc) {
      const limit = FILE_LIMITS[extOf(file)] || 0;
      if (file.size > limit) {
        const mb = Math.round(limit / (1024 * 1024));
        setPending(prev => prev.map(p => p.id === slotId ? { ...p, error: `Too big (max ${mb} MB)` } : p));
        return null;
      }
    }

    try {
      // ── Image branch — resize then upload ─────────────────────────────
      if (asImage) {
        setPending(prev => prev.map(p => p.id === slotId ? { ...p, phase: 'resizing' } : p));
        const blob = await shrinkImage(file);
        setPending(prev => prev.map(p => p.id === slotId ? { ...p, phase: 'uploading', progress: 1 } : p));

        const fd = new FormData();
        const safeName = (file.name || 'image').replace(/[^\w.\- ]+/g, '_');
        fd.append('file', blob, safeName);
        const r = await client.post<DiaryAttachment>('/diary/upload-image', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (e) => {
            if (!e.total) return;
            const pct = Math.max(1, Math.round((e.loaded / e.total) * 100));
            setPending(prev => prev.map(p => p.id === slotId ? { ...p, progress: pct } : p));
          },
        });
        return r.data;
      }

      // ── Document branch — straight upload, no client-side processing ─
      setPending(prev => prev.map(p => p.id === slotId ? { ...p, phase: 'uploading', progress: 1 } : p));
      const fd = new FormData();
      const safeName = (file.name || 'document').replace(/[^\w.\- ]+/g, '_');
      fd.append('file', file, safeName);
      const r = await client.post<DiaryAttachment>('/diary/upload-file', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (!e.total) return;
          const pct = Math.max(1, Math.round((e.loaded / e.total) * 100));
          setPending(prev => prev.map(p => p.id === slotId ? { ...p, progress: pct } : p));
        },
      });
      return r.data;
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Upload failed';
      setPending(prev => prev.map(p => p.id === slotId ? { ...p, error: msg } : p));
      return null;
    }
  }, []);

  const ingestFiles = useCallback(async (files: FileList | File[]) => {
    if (disabled) return;
    const incoming = Array.from(files).filter(f => isImage(f) || isDoc(f));
    if (incoming.length === 0) return;

    const remaining = max - value.length - pending.length;
    if (remaining <= 0) return;
    const toProcess = incoming.slice(0, remaining);

    // Create pending slots immediately for instant UI feedback
    const slots: PendingItem[] = toProcess.map(f => {
      const asImage = isImage(f);
      return {
        id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        // Only images get an object URL — files render the icon card.
        previewUrl: asImage ? URL.createObjectURL(f) : '',
        kind: asImage ? 'image' : 'file',
        displayName: f.name || (asImage ? 'image' : 'document'),
        ext: extOf(f) || (asImage ? 'img' : 'doc'),
        size: f.size,
        progress: 0,
        phase: 'queued',
      };
    });
    setPending(prev => [...prev, ...slots]);

    // CRITICAL: yield to the browser so it paints the pending thumbnails
    // BEFORE we kick off the resize + upload (which both block the main thread).
    // Without this, the user sees a blank dropzone for ~1 second on a 5 MB photo.
    await yieldToPaint();

    // Upload in parallel — modern browsers cap at ~6 per origin which is fine
    const uploaded = await Promise.all(
      toProcess.map((f, idx) => uploadOne(f, slots[idx].id))
    );

    // Promote successful uploads into value; drop failures (but keep them visible
    // so the user sees the error toast above the slot).
    const newAtts: DiaryAttachment[] = uploaded.filter(Boolean) as DiaryAttachment[];
    if (newAtts.length > 0) onChange([...value, ...newAtts]);

    // Remove successful slots from pending; keep failed ones so user can see error.
    setPending(prev => prev.filter((p, idx) => {
      const slotIdx = slots.findIndex(s => s.id === p.id);
      if (slotIdx === -1) return true;
      const wasOK = !!uploaded[slotIdx];
      if (wasOK) {
        try { URL.revokeObjectURL(p.previewUrl); } catch {}
      }
      return !wasOK;
    }));
  }, [disabled, max, value, pending.length, onChange, uploadOne]);

  // Drag-drop wiring
  const onDragOver: React.DragEventHandler = (e) => {
    e.preventDefault();
    if (!disabled) setDragOver(true);
  };
  const onDragLeave: React.DragEventHandler = (e) => {
    e.preventDefault();
    setDragOver(false);
  };
  const onDrop: React.DragEventHandler = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) ingestFiles(e.dataTransfer.files);
  };

  // Clipboard paste anywhere on the page while uploader mounted
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (disabled) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.type.startsWith('image/')) {
          const f = it.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length) {
        e.preventDefault();
        ingestFiles(files);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [disabled, ingestFiles]);

  const removeAttachment = (idx: number) => {
    if (disabled) return;
    const next = [...value];
    next.splice(idx, 1);
    onChange(next);
  };

  const dismissPending = (id: string) => {
    setPending(prev => {
      const target = prev.find(p => p.id === id);
      if (target) {
        try { URL.revokeObjectURL(target.previewUrl); } catch {}
      }
      return prev.filter(p => p.id !== id);
    });
  };

  const totalCount = value.length + pending.filter(p => !p.error).length;
  const atLimit = totalCount >= max;

  return (
    <div className="diary-uploader">
      {/* Drop / pick zone */}
      <div
        className={`diary-uploader-zone ${dragOver ? 'over' : ''} ${atLimit ? 'full' : ''} ${disabled ? 'disabled' : ''}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => !disabled && !atLimit && fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Upload images"
      >
        <FiUploadCloud size={22} />
        <div className="diary-uploader-text">
          <strong>{atLimit ? `Maximum ${max} files reached` : 'Tap, drag, or paste files'}</strong>
          <span>Images (JPG/PNG, 10 MB) · PDF up to 25 MB · Word/Excel up to 15 MB · PPT up to 25 MB</span>
        </div>
        <div className="diary-uploader-buttons" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="diary-uploader-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || atLimit}
          >
            <FiImage /> Pick files
          </button>
          <button
            type="button"
            className="diary-uploader-btn camera"
            onClick={() => cameraInputRef.current?.click()}
            disabled={disabled || atLimit}
            title="Open camera (on mobile)"
          >
            <FiCamera /> Camera
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) ingestFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          // `capture` only does anything on mobile — desktop ignores it.
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          capture="environment"
          hidden
          onChange={(e) => {
            if (e.target.files) ingestFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {/* Thumbnails */}
      {(value.length > 0 || pending.length > 0) && (
        <div className="diary-uploader-thumbs">
          {value.map((att, i) => (
            att.kind === 'file' ? (
              <div key={att.url} className="diary-thumb diary-thumb-file" title={att.original_name || ''}>
                <div className={`diary-file-icon ext-${att.ext || 'doc'}`}>
                  <span className="diary-file-ext">{(att.ext || 'FILE').toUpperCase()}</span>
                </div>
                <div className="diary-file-meta">
                  <div className="diary-file-name">{att.original_name || 'Document'}</div>
                  <div className="diary-file-size">{prettyBytes(att.size)}</div>
                </div>
                <div className="diary-thumb-overlay">
                  <FiCheck className="diary-thumb-tick" />
                </div>
                <button
                  type="button"
                  className="diary-thumb-remove"
                  onClick={() => removeAttachment(i)}
                  disabled={disabled}
                  aria-label="Remove file"
                  title="Remove file"
                >
                  <FiTrash2 />
                </button>
              </div>
            ) : (
              <div key={att.url} className="diary-thumb">
                <img src={resolveApiUrl(att.thumb_url || att.url)} alt={att.original_name || `Image ${i + 1}`} loading="lazy" />
                <div className="diary-thumb-overlay">
                  <FiCheck className="diary-thumb-tick" />
                </div>
                <button
                  type="button"
                  className="diary-thumb-remove"
                  onClick={() => removeAttachment(i)}
                  disabled={disabled}
                  aria-label="Remove image"
                  title="Remove image"
                >
                  <FiTrash2 />
                </button>
              </div>
            )
          ))}
          {pending.map(p => {
            const label =
              p.phase === 'resizing' ? 'Resizing…' :
              p.phase === 'uploading' ? `${p.progress}%` :
              'Preparing…';
            // Show a visible bar during resize too — pulse if no real progress yet.
            const barWidth = p.phase === 'uploading' ? p.progress : (p.phase === 'resizing' ? 30 : 5);
            const classes = `diary-thumb ${p.kind === 'file' ? 'diary-thumb-file' : ''} ${p.error ? 'has-error' : 'is-pending'}`;
            return (
              <div key={p.id} className={classes} title={p.displayName}>
                {p.kind === 'image' ? (
                  <img src={p.previewUrl} alt="Uploading…" />
                ) : (
                  <>
                    <div className={`diary-file-icon ext-${p.ext}`}>
                      <span className="diary-file-ext">{p.ext.toUpperCase()}</span>
                    </div>
                    <div className="diary-file-meta">
                      <div className="diary-file-name">{p.displayName}</div>
                      <div className="diary-file-size">{prettyBytes(p.size)}</div>
                    </div>
                  </>
                )}
                {!p.error && (
                  <div className="diary-thumb-progress">
                    <div
                      className={`diary-thumb-progress-bar ${p.phase !== 'uploading' ? 'indeterminate' : ''}`}
                      style={{ width: `${barWidth}%` }}
                    />
                    <span>{label}</span>
                  </div>
                )}
                {p.error && (
                  <div className="diary-thumb-error" title={p.error}>
                    <FiAlertCircle /> {p.error}
                  </div>
                )}
                <button
                  type="button"
                  className="diary-thumb-remove"
                  onClick={() => dismissPending(p.id)}
                  aria-label="Dismiss"
                  title="Dismiss"
                >
                  <FiX />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
