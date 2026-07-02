import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { FiMenu, FiBell, FiX, FiCheckSquare, FiMessageCircle } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { getGreeting } from '../utils/helpers';
import client from '../api/client';

interface Props {
  onMenuClick: () => void;
}

const PAGE_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  students: 'Students',
  teachers: 'Teachers',
  classes: 'Classes',
  subjects: 'Subjects',
  fees: 'Fee Management',
  exams: 'Examinations',
  attendance: 'Attendance',
  diary: 'Daily Diary',
  notices: 'Announcements',
  transport: 'Transport',
  leaves: 'Leave Management',
  leave: 'Leave Management',
  results: 'Results',
  analytics: 'Analytics',
  leaderboard: 'Leaderboard',
  'child-progress': 'Child Progress',
  schools: 'Schools',
  settings: 'Settings',
  expenses: 'Expenses',
  enquiries: 'Enquiries',
  'staff-attendance': 'Staff Attendance',
  permissions: 'Staff Permissions',
  timetable: 'Timetable',
};

const NOTIF_ICONS: Record<string, string> = {
  ENQUIRY: '💬',
  FEE: '💰',
  NOTICE: '📢',
  EXAM: '📝',
  HOMEWORK: '📚',
  ATTENDANCE: '✅',
  GENERAL: '🔔',
};

export default function TopBar({ onMenuClick }: Props) {
  const { user } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [chatUnread, setChatUnread] = useState(0);
  const [notifs, setNotifs] = useState<any[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const messagesPath = user?.role === 'PARENT'
    ? '/parent/messages'
    : user?.role === 'TEACHER'
      ? '/teacher/messages'
      : '/admin/enquiries';

  const segments = location.pathname.split('/').filter(Boolean);
  const lastSegment = segments[segments.length - 1] || 'dashboard';
  const pageTitle = PAGE_TITLES[lastSegment] || lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1);

  // Poll unread counts (notifications + chat) regularly
  useEffect(() => {
    fetchUnread();
    fetchChatUnread();
    const interval = setInterval(() => { fetchUnread(); fetchChatUnread(); }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Close panel on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchUnread = () => {
    client.get('/notifications/unread-count').then(res => setUnread(res.data.count || 0)).catch(() => {});
  };
  const fetchChatUnread = () => {
    client.get('/chat/unread-count').then(res => setChatUnread(res.data.count || 0)).catch(() => {});
  };

  const openPanel = () => {
    setPanelOpen(v => !v);
    if (!panelOpen) {
      client.get('/notifications?limit=20').then(res => setNotifs(res.data || [])).catch(() => {});
    }
  };

  const markAllRead = async () => {
    await client.patch('/notifications/read-all').catch(() => {});
    setUnread(0);
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const markOne = async (id: string) => {
    await client.patch(`/notifications/${id}/read`).catch(() => {});
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnread(prev => Math.max(0, prev - 1));
  };

  const timeAgo = (dt: string) => {
    const diff = Date.now() - new Date(dt).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="mobile-menu-btn" onClick={onMenuClick} aria-label="Open menu">
          <FiMenu />
        </button>
        <div>
          <h2>{pageTitle}</h2>
          <p>{getGreeting()}, {user?.first_name}!</p>
        </div>
      </div>

      <div className="topbar-right">
        {/* Messages icon */}
        <button
          className="btn-icon notification-btn"
          aria-label="Messages"
          onClick={() => navigate(messagesPath)}
          style={{ position: 'relative', marginRight: 4 }}
        >
          <FiMessageCircle />
          {chatUnread > 0 && (
            <span style={{
              position: 'absolute', top: 4, right: 4,
              background: 'var(--success-500)', color: '#fff',
              borderRadius: '999px', fontSize: '0.65rem',
              minWidth: 16, height: 16, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, padding: '0 3px',
            }}>
              {chatUnread > 99 ? '99+' : chatUnread}
            </span>
          )}
        </button>

        {/* Notification Bell */}
        <div style={{ position: 'relative' }} ref={panelRef}>
          <button
            className="btn-icon notification-btn"
            aria-label="Notifications"
            onClick={openPanel}
            style={{ position: 'relative' }}
          >
            <FiBell />
            {unread > 0 && (
              <span className="notification-badge" style={{
                position: 'absolute', top: 4, right: 4,
                background: 'var(--danger-500)', color: '#fff',
                borderRadius: '999px', fontSize: '0.65rem',
                minWidth: 16, height: 16, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, padding: '0 3px',
              }}>
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </button>

          {panelOpen && (
            <div style={{
              position: 'absolute', right: 0, top: 'calc(100% + 8px)',
              width: 340, background: '#fff', borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-xl)', border: '1px solid var(--gray-200)',
              zIndex: 1000, overflow: 'hidden',
            }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--gray-100)' }}>
                <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Notifications</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  {unread > 0 && (
                    <button onClick={markAllRead} style={{ fontSize: '0.75rem', color: 'var(--primary-600)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <FiCheckSquare size={13} /> Mark all read
                    </button>
                  )}
                  <button onClick={() => setPanelOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', padding: 2 }}>
                    <FiX size={16} />
                  </button>
                </div>
              </div>

              {/* List */}
              <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                {notifs.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--gray-400)' }}>
                    <FiBell size={28} style={{ marginBottom: 8 }} />
                    <p style={{ fontSize: '0.85rem' }}>No notifications yet</p>
                  </div>
                ) : notifs.map(n => (
                  <div
                    key={n.id}
                    onClick={() => !n.is_read && markOne(n.id)}
                    style={{
                      display: 'flex', gap: 10, padding: '10px 16px',
                      background: n.is_read ? '#fff' : 'var(--primary-50)',
                      borderBottom: '1px solid var(--gray-50)',
                      cursor: n.is_read ? 'default' : 'pointer',
                      transition: 'background .15s',
                    }}
                  >
                    <span style={{ fontSize: '1.2rem', flexShrink: 0, marginTop: 2 }}>
                      {NOTIF_ICONS[n.notification_type] || '🔔'}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: n.is_read ? 400 : 600, fontSize: '0.85rem', color: 'var(--gray-800)', marginBottom: 2 }}>{n.title}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--gray-500)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.body}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--gray-400)', marginTop: 3 }}>{timeAgo(n.created_at)}</div>
                    </div>
                    {!n.is_read && <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--primary-500)', flexShrink: 0, marginTop: 6 }} />}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
