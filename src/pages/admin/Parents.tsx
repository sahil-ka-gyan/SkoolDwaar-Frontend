import { toast } from '../../utils/toast';
import React, { useEffect, useState, useMemo } from 'react';
import { FiPlus, FiSearch, FiEdit2, FiTrash2, FiX, FiUsers, FiPhone, FiMail, FiUser } from 'react-icons/fi';
import client from '../../api/client';
import { getInitials } from '../../utils/helpers';

export default function Parents() {
  const [parents, setParents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [children, setChildren] = useState<any[]>([]);
  const [childLoading, setChildLoading] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editParent, setEditParent] = useState<any>(null);
  const empty = { first_name: '', last_name: '', email: '', phone: '', occupation: '', address: '', relation: 'Father', password: '1234' };
  const [form, setForm] = useState({ ...empty });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Link student modal
  const [linkOpen, setLinkOpen] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [linkStudentId, setLinkStudentId] = useState('');
  const [linkRelation, setLinkRelation] = useState('Father');

  useEffect(() => { fetchParents(); }, []);

  const fetchParents = async () => {
    setLoading(true);
    try {
      const r = await client.get('/admin/parents');
      setParents(r.data || []);
    } catch { setParents([]); }
    setLoading(false);
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return parents;
    const q = search.toLowerCase();
    return parents.filter(p =>
      `${p.first_name || ''} ${p.last_name || ''} ${p.email || ''} ${p.phone || ''}`.toLowerCase().includes(q)
    );
  }, [parents, search]);

  const loadChildren = async (p: any) => {
    setSelected(p);
    setChildLoading(true);
    try {
      const r = await client.get(`/admin/parents/${p.id}/children`);
      setChildren(r.data || []);
    } catch { setChildren([]); }
    setChildLoading(false);
  };

  const openAdd = () => { setForm({ ...empty }); setEditParent(null); setShowModal(true); };
  const openEditParent = (p: any) => {
    setEditParent(p);
    setForm({
      first_name: p.first_name || '', last_name: p.last_name || '',
      email: p.email || '', phone: p.phone || '',
      occupation: p.occupation || '', address: p.address || '',
      relation: p.relation || 'Father', password: '1234',
    });
    setShowModal(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editParent) {
        const patch: any = {
          first_name: form.first_name, last_name: form.last_name,
          email: form.email, phone: form.phone,
          occupation: form.occupation || null, address: form.address || null,
          relation: form.relation,
        };
        await client.patch(`/admin/parents/${editParent.id}`, patch);
      } else {
        await client.post('/admin/parents', form);
      }
      setShowModal(false);
      await fetchParents();
      if (selected) await loadChildren(selected);
    } catch (err: any) { toast.error(err?.response?.data?.detail || 'Error'); }
    setSaving(false);
  };

  const doDelete = async () => {
    if (!deleteId) return;
    await client.delete(`/admin/parents/${deleteId}`).catch(() => {});
    setDeleteId(null);
    if (selected?.id === deleteId) { setSelected(null); setChildren([]); }
    fetchParents();
  };

  // Link student
  const openLink = async () => {
    setLinkOpen(true);
    setLinkStudentId(''); setLinkRelation('Father');
    if (students.length === 0) {
      try { const r = await client.get('/students'); setStudents(r.data || []); } catch {}
    }
  };
  const linkStudent = async () => {
    if (!selected || !linkStudentId) return;
    await client.post(`/admin/parents/${selected.id}/link-student/${linkStudentId}`, null, {
      params: { relation: linkRelation },
    }).catch((err: any) => toast.error(err?.response?.data?.detail || 'Error'));
    setLinkOpen(false);
    loadChildren(selected);
  };

  const unlinkStudent = async (sid: string) => {
    if (!selected) return;
    if (!confirm('Unlink this child from this parent?')) return;
    await client.delete(`/admin/parents/${selected.id}/unlink-student/${sid}`).catch(() => {});
    loadChildren(selected);
  };

  const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9'];

  return (
    <div>
      <div className="page-header">
        <h1>👨‍👩‍👧 Parents</h1>
        <div className="actions">
          <button className="btn btn-primary btn-sm" style={{ width: 'auto' }} onClick={openAdd}><FiPlus /> Add Parent</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 16, alignItems: 'flex-start' }}>
        {/* Left — parents list */}
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: 12, borderBottom: '1px solid var(--gray-100)', position: 'relative' }}>
            <FiSearch style={{ position: 'absolute', left: 22, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
            <input type="text" placeholder="Search by name, phone, email..." value={search}
              onChange={e => setSearch(e.target.value)} style={{ paddingLeft: '2.2rem', width: '100%' }} />
          </div>
          <div style={{ maxHeight: 'calc(100vh - 240px)', overflowY: 'auto' }}>
            {loading ? <div className="spinner-container"><div className="spinner" /></div>
              : filtered.length === 0 ? <p style={{ padding: 16, color: 'var(--gray-400)', fontSize: '0.85rem', textAlign: 'center' }}>No parents found</p>
              : filtered.map((p: any, i) => (
                <div key={p.id} onClick={() => loadChildren(p)} style={{
                  padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--gray-100)',
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: selected?.id === p.id ? 'var(--primary-50)' : 'transparent',
                  borderLeft: selected?.id === p.id ? '3px solid var(--primary-500)' : '3px solid transparent',
                }}>
                  <div className="avatar" style={{ background: colors[i % colors.length] }}>{getInitials(`${p.first_name || ''} ${p.last_name || ''}`)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{p.first_name} {p.last_name}</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--gray-400)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.phone || '—'} • {p.children_count} child{p.children_count === 1 ? '' : 'ren'}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Right — parent details + children */}
        <div>
          {!selected ? (
            <div className="card"><div className="empty-state">
              <FiUsers size={32} style={{ color: 'var(--gray-300)' }} />
              <h3>Select a parent</h3>
              <p>Pick a parent from the left to view linked children and details</p>
            </div></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Parent header */}
              <div className="card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div className="avatar" style={{ background: 'var(--primary-500)', width: 50, height: 50, fontSize: '1.1rem' }}>{getInitials(`${selected.first_name || ''} ${selected.last_name || ''}`)}</div>
                    <div>
                      <h2 style={{ margin: 0, fontSize: '1.15rem' }}>{selected.first_name} {selected.last_name}
                        <span className="badge badge-neutral" style={{ marginLeft: 8, fontSize: '0.7rem' }}>{selected.relation || 'Parent'}</span>
                      </h2>
                      <div style={{ fontSize: '0.82rem', color: 'var(--gray-500)', marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <span><FiMail size={11} /> {selected.email || '—'}</span>
                        <span><FiPhone size={11} /> {selected.phone || '—'}</span>
                      </div>
                      {selected.occupation && <div style={{ fontSize: '0.78rem', color: 'var(--gray-500)', marginTop: 2 }}>💼 {selected.occupation}</div>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => openEditParent(selected)}><FiEdit2 size={12} /> Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={() => setDeleteId(selected.id)}><FiTrash2 size={12} /> Delete</button>
                  </div>
                </div>
              </div>

              {/* Children */}
              <div className="card">
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Linked Children ({children.length})</h3>
                  <button className="btn btn-primary btn-sm" style={{ padding: '4px 12px' }} onClick={openLink}><FiPlus size={12} /> Link Child</button>
                </div>
                <div className="card-body no-padding">
                  {childLoading ? (
                    <div className="spinner-container"><div className="spinner" /></div>
                  ) : children.length === 0 ? (
                    <div className="empty-state">
                      <FiUser size={28} style={{ color: 'var(--gray-300)' }} />
                      <h3>No children linked</h3>
                      <p>Click "Link Child" to attach a student to this parent</p>
                    </div>
                  ) : (
                    <table className="data-table">
                      <thead><tr><th>Student</th><th>Admission No</th><th>Class</th><th>Relation</th><th>Action</th></tr></thead>
                      <tbody>
                        {children.map((c: any, i) => (
                          <tr key={c.student_id}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div className="avatar" style={{ background: colors[i % colors.length] }}>{getInitials(`${c.first_name || ''} ${c.last_name || ''}`)}</div>
                                <div style={{ fontWeight: 700 }}>{c.first_name} {c.last_name}</div>
                              </div>
                            </td>
                            <td><span className="badge badge-primary">{c.admission_no}</span></td>
                            <td style={{ fontSize: '0.85rem' }}>{c.class_name}{c.section_name ? ` - ${c.section_name}` : ''}</td>
                            <td><span className="badge badge-neutral">{c.relation}</span></td>
                            <td>
                              <button className="btn-icon" title="Unlink" style={{ color: 'var(--danger-500)' }} onClick={() => unlinkStudent(c.student_id)}><FiX size={14} /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit parent modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header"><h3>{editParent ? 'Edit Parent' : 'Add Parent'}</h3><button className="btn-icon" onClick={() => setShowModal(false)}><FiX /></button></div>
            <form onSubmit={save} autoComplete="off">
              <input type="text" name="prevent_autofill" autoComplete="off" style={{ display: 'none' }} />
              <input type="password" name="prevent_autofill_pw" autoComplete="new-password" style={{ display: 'none' }} />
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group"><label>First Name *</label><input className="form-input" required value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} /></div>
                  <div className="form-group"><label>Last Name *</label><input className="form-input" required value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} /></div>
                  <div className="form-group"><label>Email *</label><input className="form-input" type="email" name="parent_email_field" autoComplete="off" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
                  <div className="form-group"><label>Phone *</label><input className="form-input" required value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
                  <div className="form-group"><label>Occupation</label><input className="form-input" value={form.occupation} onChange={e => setForm({ ...form, occupation: e.target.value })} /></div>
                  <div className="form-group">
                    <label>Relation</label>
                    <select className="form-input" value={form.relation} onChange={e => setForm({ ...form, relation: e.target.value })}>
                      <option value="Father">Father</option><option value="Mother">Mother</option><option value="Guardian">Guardian</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>Address</label><input className="form-input" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
                  {!editParent && (
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                      <label>Login Password</label>
                      <input className="form-input" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="1234" />
                      <p style={{ fontSize: '0.72rem', color: 'var(--gray-400)', marginTop: 3 }}>Default: 1234</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ width: 'auto' }}>{saving ? 'Saving...' : (editParent ? 'Save' : 'Add Parent')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Link child modal */}
      {linkOpen && (
        <div className="modal-overlay" onClick={() => setLinkOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="modal-header"><h3>Link Child to {selected?.first_name}</h3><button className="btn-icon" onClick={() => setLinkOpen(false)}><FiX /></button></div>
            <div className="modal-body">
              <div className="form-group">
                <label>Student *</label>
                <select className="form-input" value={linkStudentId} onChange={e => setLinkStudentId(e.target.value)}>
                  <option value="">Select student...</option>
                  {students.map((s: any) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.admission_no})</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Relation</label>
                <select className="form-input" value={linkRelation} onChange={e => setLinkRelation(e.target.value)}>
                  <option value="Father">Father</option><option value="Mother">Mother</option><option value="Guardian">Guardian</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setLinkOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={linkStudent} style={{ width: 'auto' }} disabled={!linkStudentId}>Link</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <div className="modal-header"><h3>Delete Parent</h3><button className="btn-icon" onClick={() => setDeleteId(null)}><FiX /></button></div>
            <div className="modal-body"><p>This will permanently delete the parent and their login account. Linked children will be unlinked but not deleted.</p></div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={doDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
