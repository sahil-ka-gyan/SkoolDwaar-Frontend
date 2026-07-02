import React, { useEffect, useState } from 'react';
import { FiClock, FiPlus, FiX, FiCheck, FiUser } from 'react-icons/fi';
import client from '../../api/client';
import { formatDate, getInitials } from '../../utils/helpers';

export default function ParentLeave() {
  const [children, setChildren] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string>(() => localStorage.getItem('selectedChildId') || '');
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ leave_type: 'Sick', from_date: '', to_date: '', reason: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    client.get('/parent/children').then(r => {
      const list = r.data || [];
      setChildren(list);
      if (list.length > 0 && (!selectedId || !list.find((c: any) => c.student_id === selectedId))) {
        setSelectedId(list[0].student_id);
      }
    }).catch(() => {});
    loadLeaves();
  }, []);

  const loadLeaves = () => {
    setLoading(true);
    client.get('/leave/my')
      .then(r => setLeaves(Array.isArray(r.data) ? r.data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) { setError('Select a child'); return; }
    if (!form.from_date || !form.to_date || !form.reason) { setError('All fields required'); return; }
    setSaving(true); setError('');
    try {
      await client.post(`/leave/for-child/${selectedId}`, form);
      setShowModal(false);
      setForm({ leave_type: 'Sick', from_date: '', to_date: '', reason: '' });
      loadLeaves();
    } catch (err: any) { setError(err?.response?.data?.detail || 'Failed to submit'); }
    setSaving(false);
  };

  const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444'];
  const selected = children.find(c => c.student_id === selectedId);

  const pending = leaves.filter(l => l.status === 'PENDING').length;
  const approved = leaves.filter(l => l.status === 'APPROVED').length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>📅 Children's Leave</h1>
          <p className="text-muted">Apply leave on behalf of your child and track approvals</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)} disabled={children.length === 0}>
          <FiPlus style={{ marginRight: 6 }} /> Apply Leave for Child
        </button>
      </div>

      {children.length === 0 ? (
        <div className="card"><div className="empty-state"><FiUser size={28} style={{ color: 'var(--gray-300)' }} /><h3>No children linked</h3></div></div>
      ) : (
        <>
          {/* Child switcher (only for previewing/selecting which child to default to in apply modal) */}
          <div className="card" style={{ marginBottom: 16, padding: 12 }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--gray-500)', marginBottom: 8, fontWeight: 600 }}>Default child for new applications:</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {children.map((c: any, i) => {
                const active = c.student_id === selectedId;
                return (
                  <button key={c.student_id} onClick={() => { setSelectedId(c.student_id); localStorage.setItem('selectedChildId', c.student_id); }} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
                    background: active ? 'var(--primary-50)' : '#fff',
                    border: active ? '2px solid var(--primary-500)' : '1px solid var(--gray-200)',
                    borderRadius: 'var(--radius-md)', cursor: 'pointer',
                  }}>
                    <div className="avatar" style={{ background: colors[i % colors.length], width: 28, height: 28, fontSize: '0.75rem' }}>{getInitials(`${c.first_name || ''} ${c.last_name || ''}`)}</div>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{c.first_name} {c.last_name}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)' }}>{c.class_name}{c.section_name ? ` - ${c.section_name}` : ''}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
            <div className="stat-card blue"><div className="stat-icon blue"><FiClock /></div><div className="stat-info"><span className="label">Total Applied</span><span className="value">{leaves.length}</span></div></div>
            <div className="stat-card amber"><div className="stat-icon amber"><FiClock /></div><div className="stat-info"><span className="label">Pending</span><span className="value">{pending}</span></div></div>
            <div className="stat-card green"><div className="stat-icon green"><FiCheck /></div><div className="stat-info"><span className="label">Approved</span><span className="value">{approved}</span></div></div>
          </div>

          <div className="card">
            <div className="card-header"><h3>Leave History (all children)</h3></div>
            <div className="card-body no-padding">
              {loading ? (
                <div className="spinner-container"><div className="spinner" /></div>
              ) : leaves.length === 0 ? (
                <div className="empty-state">
                  <FiClock size={32} style={{ color: 'var(--gray-300)' }} />
                  <h3>No leave applications yet</h3>
                  <p>Click "Apply Leave for Child" to submit your first request</p>
                </div>
              ) : (
                <div className="data-table-wrapper">
                  <table className="data-table">
                    <thead><tr><th>Child</th><th>Type</th><th>From → To</th><th>Days</th><th>Reason</th><th>Status</th><th>Applied On</th></tr></thead>
                    <tbody>
                      {leaves.map((l: any) => (
                        <tr key={l.id}>
                          <td>
                            <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{l.applicant_name}</div>
                            {l.class_info && <div style={{ fontSize: '0.7rem', color: 'var(--gray-400)' }}>{l.class_info}</div>}
                          </td>
                          <td><span className="badge badge-info">{l.leave_type}</span></td>
                          <td style={{ fontSize: '0.82rem' }}>
                            <div>{formatDate(l.from_date)}</div>
                            <div style={{ color: 'var(--gray-500)' }}>→ {formatDate(l.to_date)}</div>
                          </td>
                          <td style={{ fontWeight: 700 }}>{l.days}d</td>
                          <td style={{ fontSize: '0.82rem', color: 'var(--gray-600)', maxWidth: 240 }}>{l.reason}</td>
                          <td>
                            <span className={`badge ${l.status === 'APPROVED' ? 'badge-success' : l.status === 'REJECTED' ? 'badge-danger' : 'badge-warning'}`}>
                              {l.status}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.78rem', color: 'var(--gray-400)' }}>{formatDate(l.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Apply modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header"><h3>Apply Leave for Child</h3><button className="modal-close" onClick={() => setShowModal(false)}><FiX /></button></div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body" style={{ display: 'grid', gap: '0.85rem' }}>
                {error && <div className="login-alert error">{error}</div>}
                <div className="form-group">
                  <label>Child *</label>
                  <select className="form-input" required value={selectedId} onChange={e => setSelectedId(e.target.value)}>
                    <option value="">Select child...</option>
                    {children.map((c: any) => <option key={c.student_id} value={c.student_id}>{c.first_name} {c.last_name} ({c.class_name}{c.section_name ? ` - ${c.section_name}` : ''})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Leave Type *</label>
                  <select className="form-input" value={form.leave_type} onChange={e => setForm(f => ({ ...f, leave_type: e.target.value }))}>
                    {['Sick', 'Medical', 'Casual', 'Emergency', 'Personal', 'Family'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group"><label>From *</label><input type="date" className="form-input" required value={form.from_date} onChange={e => setForm(f => ({ ...f, from_date: e.target.value }))} /></div>
                  <div className="form-group"><label>To *</label><input type="date" className="form-input" required value={form.to_date} onChange={e => setForm(f => ({ ...f, to_date: e.target.value }))} /></div>
                </div>
                <div className="form-group">
                  <label>Reason *</label>
                  <textarea className="form-input" rows={3} required placeholder="Reason for your child's leave..." value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
                </div>
                <p style={{ fontSize: '0.72rem', color: 'var(--gray-400)' }}>Sick / Medical leaves are auto-approved. Other types start as Pending.</p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Submitting…' : 'Submit'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
