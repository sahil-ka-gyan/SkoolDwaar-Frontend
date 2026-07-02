import { toast } from '../../utils/toast';
import React, { useState, useEffect } from 'react';
import { FiPlus, FiBell, FiTrash2, FiX } from 'react-icons/fi';
import client from '../../api/client';
import { formatDate } from '../../utils/helpers';

const TARGET_ROLES = [
  { value: 'ALL', label: 'Everyone (Students, Teachers, Parents)' },
  { value: 'STUDENT', label: 'Students only' },
  { value: 'TEACHER', label: 'Teachers only' },
  { value: 'PARENT', label: 'Parents only' },
];

const ROLE_BADGE: Record<string, { bg: string; color: string }> = {
  ALL:     { bg: '#eef2ff', color: '#4f46e5' },
  STUDENT: { bg: '#d1fae5', color: '#059669' },
  TEACHER: { bg: '#fef3c7', color: '#d97706' },
  PARENT:  { bg: '#f0f9ff', color: '#0284c7' },
};

export default function Announcements() {
  const [notices, setNotices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', target_role: 'ALL' });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => { fetchNotices(); }, []);

  const fetchNotices = () => {
    setLoading(true);
    client.get('/notices').then(r => setNotices(Array.isArray(r.data) ? r.data : [])).catch(() => {}).finally(() => setLoading(false));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await client.post('/notices', form);
      setShowModal(false);
      setForm({ title: '', content: '', target_role: 'ALL' });
      fetchNotices();
    } catch (err: any) { toast.error(err?.response?.data?.detail || 'Error'); }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await client.delete(`/notices/${deleteId}`).catch(() => {});
    setDeleteId(null);
    fetchNotices();
  };

  return (
    <div>
      <div className="page-header">
        <h1>Announcements</h1>
        <div className="actions">
          <button className="btn btn-primary btn-sm" style={{ width: 'auto' }} onClick={() => setShowModal(true)}>
            <FiPlus /> Post Announcement
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          {loading ? (
            <div className="spinner-container"><div className="spinner" /></div>
          ) : notices.length === 0 ? (
            <div className="empty-state">
              <FiBell size={32} style={{ color: 'var(--gray-300)' }} />
              <h3>No announcements yet</h3>
              <p>Post an announcement to keep everyone informed</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {notices.map(n => {
                const badge = ROLE_BADGE[n.target_role] || ROLE_BADGE.ALL;
                return (
                  <div key={n.id} style={{ padding: '14px 16px', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-md)', background: '#fff', display: 'flex', gap: 14 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: badge.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FiBell style={{ color: badge.color }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>{n.title}</h4>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                          <span style={{ padding: '2px 10px', borderRadius: 'var(--radius-full)', background: badge.bg, color: badge.color, fontSize: '0.72rem', fontWeight: 600 }}>
                            {n.target_role === 'ALL' ? 'Everyone' : n.target_role.charAt(0) + n.target_role.slice(1).toLowerCase() + 's'}
                          </span>
                          <button className="btn-icon" style={{ width: 28, height: 28, color: 'var(--danger-400)' }} onClick={() => setDeleteId(n.id)}><FiTrash2 size={13} /></button>
                        </div>
                      </div>
                      <p style={{ margin: '4px 0 6px', fontSize: '0.88rem', color: 'var(--gray-600)', lineHeight: 1.5 }}>{n.content}</p>
                      <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--gray-400)' }}>{formatDate(n.created_at)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header"><h3>Post Announcement</h3><button className="btn-icon" onClick={() => setShowModal(false)}><FiX /></button></div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group"><label>Title *</label><input className="form-input" required placeholder="Important Notice" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></div>
                <div className="form-group"><label>Message *</label><textarea className="form-input" rows={4} required placeholder="Write your announcement here..." value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} /></div>
                <div className="form-group">
                  <label>Visible to</label>
                  <select className="form-input" value={form.target_role} onChange={e => setForm(p => ({ ...p, target_role: e.target.value }))}>
                    {TARGET_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ width: 'auto' }}>{saving ? 'Posting...' : 'Post Announcement'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <div className="modal-header"><h3>Delete Announcement</h3><button className="btn-icon" onClick={() => setDeleteId(null)}><FiX /></button></div>
            <div className="modal-body"><p>Delete this announcement? Students, teachers and parents will no longer see it.</p></div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
