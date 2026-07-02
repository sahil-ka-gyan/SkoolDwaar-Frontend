import { toast } from '../../utils/toast';
import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiGrid, FiPower, FiX } from 'react-icons/fi';
import client from '../../api/client';
import { formatDate } from '../../utils/helpers';

const PLANS = ['STARTER', 'STANDARD', 'PREMIUM', 'ENTERPRISE'];
const empty = { name: '', code: '', address: '', subscription_plan: 'STARTER', logo_url: '' };

export default function Schools() {
  const [schools, setSchools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => { fetch(); }, []);

  const fetch = () => {
    setLoading(true);
    client.get('/super/schools')
      .then(r => setSchools(Array.isArray(r.data) ? r.data : r.data.schools || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const openAdd = () => { setForm({ ...empty }); setEditId(null); setShowModal(true); };
  const openEdit = (s: any) => {
    setForm({ name: s.name, code: s.code, address: s.address || '', subscription_plan: s.subscription_plan || 'STARTER', logo_url: s.logo_url || '' });
    setEditId(s.id);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editId) {
        await client.patch(`/super/schools/${editId}`, form);
      } else {
        await client.post('/super/schools', form);
      }
      setShowModal(false);
      fetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Error saving school');
    }
    setSaving(false);
  };

  const toggleActive = async (s: any) => {
    setToggling(s.id);
    try {
      await client.patch(`/super/schools/${s.id}`, { is_active: !s.is_active });
      fetch();
    } catch {}
    setToggling(null);
  };

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div>
      <div className="page-header">
        <h1>Manage Schools</h1>
        <div className="actions">
          <button className="btn btn-primary btn-sm" style={{ width: 'auto' }} onClick={openAdd}>
            <FiPlus /> Add School
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-body no-padding">
          {loading ? (
            <div className="spinner-container"><div className="spinner" /></div>
          ) : schools.length === 0 ? (
            <div className="empty-state">
              <FiGrid style={{ fontSize: '2.5rem', color: 'var(--gray-300)' }} />
              <h3>No schools onboarded</h3>
              <p>Add your first school to get started</p>
            </div>
          ) : (
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>School</th>
                    <th>Code</th>
                    <th>Address</th>
                    <th>Plan</th>
                    <th>Created</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {schools.map(s => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>{s.name}</td>
                      <td><span className="badge badge-neutral">{s.code || '—'}</span></td>
                      <td style={{ color: 'var(--gray-500)', fontSize: '0.82rem', maxWidth: 200 }}>{s.address || '—'}</td>
                      <td><span className="badge badge-primary">{s.subscription_plan || 'Free'}</span></td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--gray-400)' }}>{formatDate(s.created_at)}</td>
                      <td>
                        <span className={`badge ${s.is_active ? 'badge-success' : 'badge-danger'}`}>
                          <span className="status-dot" style={{ background: s.is_active ? 'var(--success-500)' : 'var(--danger-500)' }} />
                          {s.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn-icon" title="Edit" onClick={() => openEdit(s)}><FiEdit2 /></button>
                          <button
                            className="btn-icon"
                            title={s.is_active ? 'Deactivate' : 'Activate'}
                            disabled={toggling === s.id}
                            onClick={() => toggleActive(s)}
                            style={{ color: s.is_active ? 'var(--danger-500)' : 'var(--success-600)' }}
                          >
                            <FiPower />
                          </button>
                        </div>
                      </td>
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
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h3>{editId ? 'Edit School' : 'Add New School'}</h3>
              <button className="btn-icon" onClick={() => setShowModal(false)}><FiX /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>School Name *</label>
                  <input className="form-input" required value={form.name} onChange={e => f('name', e.target.value)} placeholder="Delhi Public School" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label>School Code *</label>
                    <input className="form-input" required value={form.code} onChange={e => f('code', e.target.value.toUpperCase())} placeholder="DPS001" disabled={!!editId} />
                    {editId && <p style={{ fontSize: '0.72rem', color: 'var(--gray-400)', marginTop: 3 }}>Code cannot be changed</p>}
                  </div>
                  <div className="form-group">
                    <label>Subscription Plan</label>
                    <select className="form-input" value={form.subscription_plan} onChange={e => f('subscription_plan', e.target.value)}>
                      {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Address</label>
                  <textarea className="form-input" rows={2} value={form.address} onChange={e => f('address', e.target.value)} placeholder="Full school address" />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ width: 'auto' }}>
                  {saving ? 'Saving...' : (editId ? 'Save Changes' : 'Add School')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
