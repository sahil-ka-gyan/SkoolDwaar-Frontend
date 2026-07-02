import { toast } from '../../utils/toast';
import React, { useState, useEffect, useMemo } from 'react';
import { FiClock, FiCheck, FiX, FiPlus, FiSearch, FiUser, FiTruck, FiUsers, FiCalendar } from 'react-icons/fi';
import client from '../../api/client';
import { formatDate, getInitials } from '../../utils/helpers';

type RoleTab = 'ALL' | 'TEACHER' | 'STUDENT' | 'DRIVER' | 'PARENT' | 'SCHOOL_ADMIN';
type StatusTab = '' | 'PENDING' | 'APPROVED' | 'REJECTED';

const ROLE_LABELS: Record<string, string> = {
  TEACHER: 'Teacher',
  STUDENT: 'Student',
  DRIVER: 'Driver',
  PARENT: 'Parent',
  SCHOOL_ADMIN: 'Admin',
  OTHER: 'Other',
};

const ROLE_COLORS: Record<string, string> = {
  TEACHER: 'var(--primary-600)',
  STUDENT: 'var(--success-600)',
  DRIVER: '#7c3aed',
  PARENT: 'var(--warning-600, #b45309)',
  SCHOOL_ADMIN: 'var(--gray-700)',
  OTHER: 'var(--gray-500)',
};

export default function Leaves() {
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleTab, setRoleTab] = useState<RoleTab>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusTab>('');
  const [search, setSearch] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);

  // Driver leave apply modal
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [buses, setBuses] = useState<any[]>([]);
  const [driverForm, setDriverForm] = useState({ bus_id: '', leave_type: 'Sick', from_date: '', to_date: '', reason: '' });
  const [saving, setSaving] = useState(false);

  const loadLeaves = () => {
    setLoading(true);
    const params: any = {};
    if (statusFilter) params.status = statusFilter;
    client.get('/leave', { params })
      .then(r => setLeaves(Array.isArray(r.data) ? r.data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadLeaves(); }, [statusFilter]);
  useEffect(() => {
    client.get('/transport/buses').then(r => setBuses(r.data || [])).catch(() => {});
  }, []);

  const updateStatus = async (id: string, status: string) => {
    setUpdating(id);
    try {
      await client.patch(`/leave/${id}`, { status });
      loadLeaves();
      window.dispatchEvent(new Event('sidebar:refresh-badges'));
    } catch {}
    finally { setUpdating(null); }
  };

  const applyDriverLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverForm.bus_id || !driverForm.from_date || !driverForm.to_date || !driverForm.reason) {
      toast.error('All fields required'); return;
    }
    setSaving(true);
    try {
      const { bus_id, ...payload } = driverForm;
      await client.post(`/leave/for-driver/${bus_id}`, payload);
      setShowDriverModal(false);
      setDriverForm({ bus_id: '', leave_type: 'Sick', from_date: '', to_date: '', reason: '' });
      loadLeaves();
      window.dispatchEvent(new Event('sidebar:refresh-badges'));
    } catch (err: any) { toast.error(err?.response?.data?.detail || 'Error'); }
    setSaving(false);
  };

  // Filtered list
  const filtered = useMemo(() => {
    let rows = leaves;
    if (roleTab !== 'ALL') rows = rows.filter(l => l.applicant_role === roleTab);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(l =>
        `${l.applicant_name || ''} ${l.leave_type || ''} ${l.reason || ''} ${l.class_info || ''}`.toLowerCase().includes(q)
      );
    }
    return rows;
  }, [leaves, roleTab, search]);

  // Role counts (within current statusFilter)
  const roleCounts = useMemo(() => {
    const c: Record<string, number> = { ALL: leaves.length, TEACHER: 0, STUDENT: 0, DRIVER: 0, PARENT: 0, SCHOOL_ADMIN: 0 };
    leaves.forEach(l => { if (c[l.applicant_role] !== undefined) c[l.applicant_role]++; });
    return c;
  }, [leaves]);

  // Status counts (overall)
  const pending = leaves.filter(l => l.status === 'PENDING').length;
  const approved = leaves.filter(l => l.status === 'APPROVED').length;
  const rejected = leaves.filter(l => l.status === 'REJECTED').length;

  const avatarColors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9'];

  return (
    <div>
      <div className="page-header">
        <h1>🗓️ Leave Management</h1>
        <div className="actions">
          <button className="btn btn-primary btn-sm" style={{ width: 'auto' }} onClick={() => { setDriverForm({ bus_id: buses[0]?.id || '', leave_type: 'Sick', from_date: '', to_date: '', reason: '' }); setShowDriverModal(true); }}>
            <FiPlus /> Apply Driver Leave
          </button>
        </div>
      </div>

      {/* Status stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 12 }}>
        <div className="stat-card amber"><div className="stat-icon amber"><FiClock /></div><div className="stat-info"><span className="label">Pending</span><span className="value">{pending}</span></div></div>
        <div className="stat-card green"><div className="stat-icon green"><FiCheck /></div><div className="stat-info"><span className="label">Approved</span><span className="value">{approved}</span></div></div>
        <div className="stat-card red"><div className="stat-icon red"><FiX /></div><div className="stat-info"><span className="label">Rejected</span><span className="value">{rejected}</span></div></div>
        <div className="stat-card blue"><div className="stat-icon blue"><FiCalendar /></div><div className="stat-info"><span className="label">Total</span><span className="value">{leaves.length}</span></div></div>
      </div>

      <div className="card">
        {/* Top bar: status filter + search */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['', 'PENDING', 'APPROVED', 'REJECTED'] as StatusTab[]).map(s => (
              <button key={s} className={`btn ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '4px 12px', fontSize: '0.78rem' }} onClick={() => setStatusFilter(s)}>
                {s || 'All'}
              </button>
            ))}
          </div>
          <div style={{ position: 'relative' }}>
            <FiSearch style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
            <input type="text" placeholder="Search name / reason..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: '2.2rem', minWidth: 240 }} />
          </div>
        </div>

        {/* Role sub-tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--gray-100)', padding: '0 16px', gap: 4, overflowX: 'auto' }}>
          {([
            { key: 'ALL', label: 'All' },
            { key: 'TEACHER', label: '👩‍🏫 Teachers' },
            { key: 'STUDENT', label: '👨‍🎓 Students' },
            { key: 'DRIVER', label: '🚌 Drivers' },
          ] as { key: RoleTab; label: string }[]).map(rt => (
            <button
              key={rt.key}
              onClick={() => setRoleTab(rt.key)}
              style={{
                background: 'transparent', border: 'none', padding: '10px 14px', cursor: 'pointer',
                fontSize: '0.85rem', fontWeight: 600,
                color: roleTab === rt.key ? 'var(--primary-600)' : 'var(--gray-500)',
                borderBottom: roleTab === rt.key ? '2px solid var(--primary-500)' : '2px solid transparent',
                marginBottom: -1, whiteSpace: 'nowrap',
              }}
            >
              {rt.label}
              <span style={{ marginLeft: 4, fontSize: '0.72rem', padding: '2px 6px', background: 'var(--gray-100)', borderRadius: 10 }}>
                {roleCounts[rt.key] || 0}
              </span>
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="card-body no-padding">
          {loading ? (
            <div className="spinner-container"><div className="spinner" /></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <FiClock size={32} style={{ color: 'var(--gray-300)' }} />
              <h3>No leave applications</h3>
              <p>Nothing matches the current filters</p>
            </div>
          ) : (
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead><tr><th>Applicant</th><th>Role</th><th>Type</th><th>From → To</th><th>Days</th><th>Reason</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {filtered.map((l, i) => (
                    <tr key={l.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {l.applicant_role === 'DRIVER' ? (
                            <div className="avatar" style={{ background: '#7c3aed', width: 30, height: 30, fontSize: '0.7rem' }}><FiTruck size={14} /></div>
                          ) : (
                            <div className="avatar" style={{ background: avatarColors[i % avatarColors.length], width: 30, height: 30, fontSize: '0.7rem' }}>{getInitials(l.applicant_name)}</div>
                          )}
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{l.applicant_name}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--gray-400)' }}>
                              {l.class_info || (l.contact ? `📞 ${l.contact}` : '—')}
                              {l.filed_by_name && <span style={{ marginLeft: 6, color: 'var(--primary-500)' }}>• filed by {l.filed_by_name}</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="badge" style={{ background: 'var(--gray-50)', color: ROLE_COLORS[l.applicant_role] || 'var(--gray-700)', fontSize: '0.7rem', border: `1px solid ${ROLE_COLORS[l.applicant_role] || 'var(--gray-200)'}` }}>
                          {ROLE_LABELS[l.applicant_role] || l.applicant_role}
                        </span>
                      </td>
                      <td><span className="badge badge-info">{l.leave_type}</span></td>
                      <td style={{ fontSize: '0.82rem' }}>
                        <div>{formatDate(l.from_date)}</div>
                        <div style={{ color: 'var(--gray-500)' }}>→ {formatDate(l.to_date)}</div>
                      </td>
                      <td><span style={{ fontWeight: 700 }}>{l.days}d</span></td>
                      <td style={{ fontSize: '0.82rem', maxWidth: 240, color: 'var(--gray-600)' }}>{l.reason || '—'}</td>
                      <td>
                        <span className={`badge ${l.status === 'APPROVED' ? 'badge-success' : l.status === 'REJECTED' ? 'badge-danger' : 'badge-warning'}`}>
                          {l.status}
                        </span>
                      </td>
                      <td>
                        {l.status === 'PENDING' && (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn btn-primary" style={{ padding: '3px 10px', fontSize: '0.75rem' }} disabled={updating === l.id} onClick={() => updateStatus(l.id, 'APPROVED')}>
                              <FiCheck size={12} /> Approve
                            </button>
                            <button className="btn btn-danger" style={{ padding: '3px 10px', fontSize: '0.75rem' }} disabled={updating === l.id} onClick={() => updateStatus(l.id, 'REJECTED')}>
                              <FiX size={12} /> Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Apply driver leave modal */}
      {showDriverModal && (
        <div className="modal-overlay" onClick={() => setShowDriverModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header"><h3>Apply Leave for Driver</h3><button className="btn-icon" onClick={() => setShowDriverModal(false)}><FiX /></button></div>
            <form onSubmit={applyDriverLeave}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Driver / Bus *</label>
                  <select className="form-input" required value={driverForm.bus_id} onChange={e => setDriverForm(p => ({ ...p, bus_id: e.target.value }))}>
                    <option value="">Select driver...</option>
                    {buses.map((b: any) => <option key={b.id} value={b.id}>{b.driver_name} — {b.bus_number} ({b.driver_phone})</option>)}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label>Leave Type *</label>
                    <select className="form-input" value={driverForm.leave_type} onChange={e => setDriverForm(p => ({ ...p, leave_type: e.target.value }))}>
                      {['Sick', 'Medical', 'Casual', 'Emergency', 'Personal'].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label>From *</label><input type="date" className="form-input" required value={driverForm.from_date} onChange={e => setDriverForm(p => ({ ...p, from_date: e.target.value }))} /></div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>To *</label><input type="date" className="form-input" required value={driverForm.to_date} onChange={e => setDriverForm(p => ({ ...p, to_date: e.target.value }))} /></div>
                </div>
                <div className="form-group"><label>Reason *</label><textarea className="form-input" rows={3} required placeholder="Why is the driver taking leave?" value={driverForm.reason} onChange={e => setDriverForm(p => ({ ...p, reason: e.target.value }))} /></div>
                <p style={{ fontSize: '0.72rem', color: 'var(--gray-400)' }}>Sick / Medical leaves are auto-approved. Other types start as Pending.</p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowDriverModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ width: 'auto' }}>{saving ? 'Submitting...' : 'Apply Leave'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
