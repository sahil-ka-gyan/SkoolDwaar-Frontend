import React, { useState, useEffect } from 'react';
import { FiBell } from 'react-icons/fi';
import client from '../../api/client';
import { formatDate } from '../../utils/helpers';

export default function ParentNotices() {
  const [notices, setNotices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  // Snapshot the previous "last seen" so we can highlight new ones in this view
  const [lastSeenAt] = useState<number>(() => {
    const v = localStorage.getItem('parent_notices_last_seen');
    return v ? new Date(v).getTime() : 0;
  });

  useEffect(() => {
    client.get('/parent/notices')
      .then(r => setNotices(Array.isArray(r.data) ? r.data : r.data.notices || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // Mark all as seen and refresh sidebar badge
    if (!loading) {
      localStorage.setItem('parent_notices_last_seen', new Date().toISOString());
      window.dispatchEvent(new Event('sidebar:refresh-badges'));
    }
  }, [loading]);

  const unreadCount = notices.filter(n => new Date(n.created_at).getTime() > lastSeenAt).length;

  return (
    <div>
      <div className="page-header">
        <h1>📢 Notices</h1>
        {unreadCount > 0 && (
          <span style={{
            background: 'var(--danger-500)', color: '#fff',
            padding: '4px 10px', borderRadius: 'var(--radius-full)',
            fontSize: '0.78rem', fontWeight: 700,
          }}>
            {unreadCount} new
          </span>
        )}
      </div>

      <div className="card">
        <div className="card-body">
          {loading ? (
            <div className="spinner-container"><div className="spinner" /></div>
          ) : notices.length === 0 ? (
            <div className="empty-state">
              <FiBell style={{ fontSize: '2.5rem', color: 'var(--gray-300)' }} />
              <h3>No notices</h3>
              <p>School notices will appear here</p>
            </div>
          ) : (
            <ul className="notice-list">
              {notices.map(n => {
                const isNew = new Date(n.created_at).getTime() > lastSeenAt;
                return (
                  <li key={n.id} className="notice-item" style={isNew ? {
                    background: 'linear-gradient(90deg, #fef3c7 0%, transparent 100%)',
                    borderLeft: '3px solid #f59e0b',
                    paddingLeft: 10,
                    borderRadius: 6,
                  } : undefined}>
                    <div className="notice-dot" style={isNew ? { background: '#f59e0b' } : undefined} />
                    <div className="notice-content">
                      <h4 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {n.title}
                        {isNew && (
                          <span style={{
                            background: 'var(--danger-500)', color: '#fff',
                            fontSize: '0.62rem', fontWeight: 700,
                            padding: '1px 6px', borderRadius: 10,
                          }}>NEW</span>
                        )}
                      </h4>
                      <p>{n.content}</p>
                      <p style={{ fontSize: '.72rem', color: 'var(--gray-400)', marginTop: '.25rem' }}>
                        {formatDate(n.created_at)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
