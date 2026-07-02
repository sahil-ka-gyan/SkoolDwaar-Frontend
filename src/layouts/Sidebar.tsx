import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { FiLogOut } from 'react-icons/fi';
import { IoSchoolOutline } from 'react-icons/io5';
import { useAuthStore } from '../stores/authStore';
import { NAV_ITEMS } from '../utils/constants';
import { getInitials } from '../utils/helpers';
import client from '../api/client';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Platform Admin',
  SCHOOL_ADMIN: 'School Admin',
  TEACHER: 'Teacher',
  STUDENT: 'Student',
  PARENT: 'Parent',
};

export default function Sidebar({ isOpen, onClose }: Props) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [chatUnread, setChatUnread] = useState(0);
  const [pendingLeaves, setPendingLeaves] = useState(0);
  const [unreadNotices, setUnreadNotices] = useState(0);

  useEffect(() => {
    if (!user) return;
    const fetchAll = () => {
      client.get('/chat/unread-count').then(r => setChatUnread(r.data?.count || 0)).catch(() => {});
      // Pending leave count — only admins see this
      if (user.role === 'SCHOOL_ADMIN' || user.role === 'SUPER_ADMIN') {
        client.get('/leave', { params: { status: 'PENDING' } })
          .then(r => setPendingLeaves(Array.isArray(r.data) ? r.data.length : 0))
          .catch(() => {});
      }
      // Unread notices count — for parents
      if (user.role === 'PARENT') {
        client.get('/parent/notices').then(r => {
          const list = Array.isArray(r.data) ? r.data : [];
          const lastSeen = localStorage.getItem('parent_notices_last_seen');
          const lastSeenTs = lastSeen ? new Date(lastSeen).getTime() : 0;
          const unread = list.filter((n: any) => new Date(n.created_at).getTime() > lastSeenTs).length;
          setUnreadNotices(unread);
        }).catch(() => {});
      }
    };
    fetchAll();
    const i = setInterval(fetchAll, 10000);
    // Listen for immediate-refresh events fired by other pages
    const onRefresh = () => fetchAll();
    window.addEventListener('sidebar:refresh-badges', onRefresh);
    return () => {
      clearInterval(i);
      window.removeEventListener('sidebar:refresh-badges', onRefresh);
    };
  }, [user]);

  if (!user) return null;

  const items = (NAV_ITEMS as Record<string, any[]>)[user.role] || [];
  const displayName = `${user.first_name} ${user.last_name}`;
  const roleLabel = ROLE_LABELS[user.role] || user.role;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      <div className={`sidebar-overlay ${isOpen ? 'open' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        {/* Brand */}
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <IoSchoolOutline />
          </div>
          <div className="sidebar-brand">
            <h3>EduVerse</h3>
            <span>{roleLabel}</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Menu</div>
          {items.map((item: any) => {
            const Icon = item.icon;
            const isMessages = item.label === 'Messages';
            const isLeaves = item.label === 'Leaves';
            const isNotices = item.label === 'Notices' && user.role === 'PARENT';
            const badgeCount = isMessages ? chatUnread : isLeaves ? pendingLeaves : isNotices ? unreadNotices : 0;
            const badgeColor = isMessages ? 'var(--primary-500)' : isNotices ? 'var(--danger-500, #ef4444)' : 'var(--warning-500, #f59e0b)';
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                onClick={onClose}
                style={{ display: 'flex', alignItems: 'center', gap: 10 }}
              >
                <Icon />
                <span style={{ flex: 1 }}>{item.label}</span>
                {badgeCount > 0 && (
                  <span style={{
                    background: badgeColor, color: '#fff',
                    fontSize: '0.7rem', fontWeight: 700,
                    padding: '1px 7px', borderRadius: 10, minWidth: 20, textAlign: 'center',
                  }}>{badgeCount > 99 ? '99+' : badgeCount}</span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer / User */}
        <div className="sidebar-footer">
          <div className="sidebar-user" onClick={handleLogout} title="Sign out">
            <div className="sidebar-avatar">{getInitials(displayName)}</div>
            <div className="sidebar-user-info">
              <div className="name">{displayName}</div>
              <div className="role">{roleLabel}</div>
            </div>
            <FiLogOut style={{ color: 'rgba(255,255,255,.4)', marginLeft: 'auto' }} />
          </div>
        </div>
      </aside>
    </>
  );
}
