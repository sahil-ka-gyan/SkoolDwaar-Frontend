import React, { useState, useEffect } from 'react';
import { FiClock, FiPlus, FiX } from 'react-icons/fi';
import client from '../../api/client';
import { formatDate } from '../../utils/helpers';

export default function StudentLeave() {
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ leave_type: 'Sick', from_date: '', to_date: '', reason: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadLeaves = () => {
    client.get('/leave/my')
      .then(r => setLeaves(Array.isArray(r.data) ? r.data : []))
      .catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { loadLeaves(); }, []);

  const handleSubmit = async () => {
    if (!form.from_date || !form.to_date || !form.reason) {
      setError('Please fill all fields'); return;
    }
    setSaving(true); setError('');
    try {
      await client.post('/leave/apply', form);
      setShowModal(false);
      setForm({ leave_type: 'Sick', from_date: '', to_date: '', reason: '' });
      loadLeaves();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to submit');
    } finally { setSaving(false); }
  };

  const pending = leaves.filter(l => l.status === 'PENDING').length;
  const approved = leaves.filter(l => l.status === 'APPROVED').length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>📅 Leave Application</h1>
          <p className="text-muted">Apply for leave and track your application status</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <FiPlus style={{ marginRight: 6 }} /> Apply for Leave
        </button>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <div className="stat-card blue">
          <div className="stat-icon blue"><FiClock /></div>
          <div className="stat-info"><span className="label">Total Applied</span><span className="value">{leaves.length}</span></div>
        </div>
        <div className="stat-card yellow">
          <div className="stat-icon yellow"><FiClock /></div>
          <div className="stat-info"><span className="label">Pending</span><span className="value">{pending}</span></div>
        </div>
        <div className="stat-card green">
          <div className="stat-icon green"><FiClock /></div>
          <div className="stat-info"><span className="label">Approved</span><span className="value">{approved}</span></div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h3>My Leave History</h3></div>
        <div className="card-body no-padding">
          {loading ? (
            <div className="spinner-container"><div className="spinner" /></div>
          ) : leaves.length === 0 ? (
            <div className="empty-state">
              <FiClock style={{ fontSize: '2.5rem', color: 'var(--gray-300)' }} />
              <h3>No leave applications yet</h3>
              <p>Click "Apply for Leave" to submit a request</p>
            </div>
          ) : (
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead><tr><th>Type</th><th>From</th><th>To</th><th>Reason</th><th>Status</th><th>Applied On</th></tr></thead>
                <tbody>
                  {leaves.map(l => (
                    <tr key={l.id}>
                      <td><span className="badge badge-info">{l.leave_type}</span></td>
                      <td className="text-sm">{formatDate(l.from_date)}</td>
                      <td className="text-sm">{formatDate(l.to_date)}</td>
                      <td className="text-sm" style={{ maxWidth: 220 }}>{l.reason}</td>
                      <td>
                        <span className={`badge ${l.status === 'APPROVED' ? 'badge-success' : l.status === 'REJECTED' ? 'badge-danger' : 'badge-warning'}`}>
                          {l.status}
                        </span>
                      </td>
                      <td className="text-sm text-muted">{formatDate(l.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Apply for Leave</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}><FiX /></button>
            </div>
            <div className="modal-body" style={{ display: 'grid', gap: '1rem' }}>
              {error && <div className="login-alert error">{error}</div>}
              <div className="form-group">
                <label>Leave Type</label>
                <select className="form-input" value={form.leave_type} onChange={e => setForm(f => ({ ...f, leave_type: e.target.value }))}>
                  {['Sick', 'Casual', 'Emergency', 'Personal', 'Family'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>From Date</label>
                  <input type="date" className="form-input" value={form.from_date} onChange={e => setForm(f => ({ ...f, from_date: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>To Date</label>
                  <input type="date" className="form-input" value={form.to_date} onChange={e => setForm(f => ({ ...f, to_date: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label>Reason</label>
                <textarea className="form-input" rows={3} placeholder="Please describe your reason…"
                  value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
                {saving ? 'Submitting…' : 'Submit Application'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
