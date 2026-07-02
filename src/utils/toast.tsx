/**
 * Global toast manager.
 * Replaces all native `alert()` calls with a non-blocking pill at bottom-right.
 *
 * Usage:
 *   import { toast } from '../utils/toast';
 *   toast.success('Saved');
 *   toast.error('Failed to save');
 *   toast.info('Heads up');
 *
 * Mount <Toaster /> once near the app root.
 */
import React, { useEffect, useState } from 'react';
import { FiCheckCircle, FiAlertCircle, FiInfo, FiX } from 'react-icons/fi';

export type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

type Subscriber = (items: ToastItem[]) => void;

let _items: ToastItem[] = [];
let _seq = 0;
const _subs = new Set<Subscriber>();

const emit = () => {
  for (const s of _subs) s(_items);
};

const removeAfter = (id: number, ms: number) => {
  setTimeout(() => {
    _items = _items.filter(t => t.id !== id);
    emit();
  }, ms);
};

const push = (kind: ToastKind, message: string, durationMs = 2800) => {
  const id = ++_seq;
  _items = [..._items, { id, kind, message }];
  emit();
  removeAfter(id, durationMs);
};

export const toast = {
  success: (msg: string, ms?: number) => push('success', msg, ms),
  error:   (msg: string, ms?: number) => push('error',   msg, ms ?? 3500),
  info:    (msg: string, ms?: number) => push('info',    msg, ms),
};

const KIND_STYLE: Record<ToastKind, { bg: string; icon: React.ComponentType<{ size?: number }> }> = {
  success: { bg: 'var(--success-600, #059669)', icon: FiCheckCircle },
  error:   { bg: 'var(--danger-600, #dc2626)',  icon: FiAlertCircle },
  info:    { bg: 'var(--gray-800, #1f2937)',    icon: FiInfo },
};

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => {
    const sub: Subscriber = (next) => setItems(next);
    _subs.add(sub);
    sub(_items);
    return () => { _subs.delete(sub); };
  }, []);

  if (items.length === 0) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none',
      maxWidth: 'calc(100vw - 40px)',
    }}>
      {items.map(t => {
        const cfg = KIND_STYLE[t.kind];
        const Icon = cfg.icon;
        return (
          <div key={t.id} style={{
            pointerEvents: 'auto',
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '11px 14px',
            background: cfg.bg, color: '#fff',
            borderRadius: 'var(--radius-md, 10px)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.20), 0 4px 8px rgba(0,0,0,0.10)',
            fontSize: '0.88rem', fontWeight: 600,
            minWidth: 260, maxWidth: 460,
            animation: 'toast-in 200ms ease-out',
          }}>
            <Icon size={18} />
            <span style={{ flex: 1, lineHeight: 1.35 }}>{t.message}</span>
            <button
              onClick={() => { _items = _items.filter(x => x.id !== t.id); emit(); }}
              style={{
                background: 'rgba(255,255,255,0.18)', border: 'none', color: '#fff',
                width: 22, height: 22, borderRadius: 11, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}
              aria-label="Dismiss"
            ><FiX size={12} /></button>
          </div>
        );
      })}
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
