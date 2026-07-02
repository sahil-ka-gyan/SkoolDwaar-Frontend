import React, { useState, useEffect } from 'react';
import { FiBell } from 'react-icons/fi';
import client from '../../api/client';
import { formatDate } from '../../utils/helpers';

export default function TeacherNotices() {
  const [notices, setNotices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get('/notices').then(r => setNotices(Array.isArray(r.data) ? r.data : r.data.notices || []))
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="page-header"><h1>📢 Notices</h1></div>
      <div className="card">
        <div className="card-body">
          {loading ? (
            <div className="spinner-container"><div className="spinner" /></div>
          ) : notices.length === 0 ? (
            <div className="empty-state"><FiBell style={{ fontSize: '2.5rem', color: 'var(--gray-300)' }} /><h3>No notices</h3></div>
          ) : (
            <ul className="notice-list">
              {notices.map(n => (
                <li key={n.id} className="notice-item">
                  <div className="notice-dot" />
                  <div className="notice-content">
                    <h4>{n.title}</h4>
                    <p>{n.content}</p>
                    <p style={{ fontSize: '.72rem', color: 'var(--gray-400)', marginTop: '.25rem' }}>{formatDate(n.created_at)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
