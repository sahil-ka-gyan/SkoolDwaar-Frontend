import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiMessageCircle, FiX } from 'react-icons/fi';
import client from '../api/client';
import { useAuthStore } from '../stores/authStore';
import { getInitials } from '../utils/helpers';

interface Toast {
  id: string;
  threadId: string;
  senderName: string;
  senderRole: string;
  preview: string;
  ts: number;
}

const ROLE_COLOR: Record<string, string> = {
  SCHOOL_ADMIN: '#6366f1',
  TEACHER: '#10b981',
  PARENT: '#f59e0b',
  SUPER_ADMIN: '#0ea5e9',
};

/**
 * Mounted once in DashboardLayout. Polls chat threads every 5s and shows
 * a toast in the bottom-right whenever a new incoming message arrives.
 * Clicking the toast navigates to the messages page.
 */
export default function ChatNotifier() {
  const { user } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const lastMessageIds = useRef<Record<string, string>>({}); // threadId → last seen message_id snippet (use timestamp)
  const initializedRef = useRef(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const messagesPath = user?.role === 'PARENT'
    ? '/parent/messages'
    : user?.role === 'TEACHER'
      ? '/teacher/messages'
      : '/admin/enquiries';

  const onMessagesPage = location.pathname === messagesPath;

  useEffect(() => {
    if (!user) return;
    const poll = async () => {
      try {
        const r = await client.get('/chat/threads');
        const threads: any[] = r.data || [];
        const snapshot: Record<string, string> = {};
        const newToasts: Toast[] = [];
        for (const t of threads) {
          const key = t.last_message_at || '';
          snapshot[t.thread_id] = key;
          // skip if no last message, or last was sent by me
          if (!t.last_message || !key) continue;
          if (t.last_sender_id === user.id) continue;
          const prev = lastMessageIds.current[t.thread_id];
          // Only fire toast if (a) we already initialized once AND (b) the message is new
          if (initializedRef.current && prev !== key && t.unread > 0) {
            if (!onMessagesPage) {
              newToasts.push({
                id: `${t.thread_id}-${key}`,
                threadId: t.thread_id,
                senderName: t.other?.name || 'Someone',
                senderRole: t.other?.display_role || t.other?.role || '',
                preview: t.last_message.slice(0, 80),
                ts: Date.now(),
              });
            }
          }
        }
        lastMessageIds.current = snapshot;
        initializedRef.current = true;
        if (newToasts.length > 0) {
          // Play a soft notification beep
          try {
            const ctx = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.connect(g); g.connect(ctx.destination);
            o.frequency.value = 880; g.gain.value = 0.04;
            o.start(); setTimeout(() => { o.stop(); ctx.close(); }, 120);
          } catch {}
          setToasts(prev => [...newToasts, ...prev].slice(0, 4));
          // Auto-dismiss after 6s
          newToasts.forEach(t => {
            setTimeout(() => setToasts(prev => prev.filter(x => x.id !== t.id)), 6000);
          });
        }
      } catch {}
    };
    poll();
    const i = setInterval(poll, 5000);
    return () => clearInterval(i);
  }, [user, onMessagesPage, messagesPath]);

  const dismiss = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));
  const openChat = (toast: Toast) => {
    dismiss(toast.id);
    navigate(messagesPath);
  };

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed', right: 20, bottom: 20, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 360,
    }}>
      {toasts.map(t => (
        <div
          key={t.id}
          onClick={() => openChat(t)}
          style={{
            background: '#fff', border: '1px solid var(--gray-200)',
            boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
            borderRadius: 'var(--radius-lg)', padding: 12,
            display: 'flex', gap: 10, alignItems: 'flex-start',
            cursor: 'pointer', animation: 'chat-toast-in 0.3s ease-out',
          }}
        >
          <div className="avatar" style={{
            background: ROLE_COLOR[t.senderRole] || ROLE_COLOR[t.senderRole.toUpperCase().replace(/ /g, '_')] || '#6366f1',
            width: 38, height: 38, fontSize: '0.78rem', flexShrink: 0,
          }}>
            {getInitials(t.senderName)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <FiMessageCircle size={14} style={{ color: 'var(--primary-500)' }} />
              <span style={{ fontWeight: 700, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.senderName}</span>
              {t.senderRole && <span style={{ fontSize: '0.68rem', color: 'var(--gray-500)' }}>· {t.senderRole}</span>}
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--gray-700)', marginTop: 3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
              {t.preview}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--primary-600)', fontWeight: 600, marginTop: 4 }}>
              Click to reply →
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); dismiss(t.id); }}
            style={{ background: 'none', border: 'none', color: 'var(--gray-400)', cursor: 'pointer', padding: 0, display: 'flex' }}
          >
            <FiX size={16} />
          </button>
        </div>
      ))}
      <style>{`
        @keyframes chat-toast-in {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
