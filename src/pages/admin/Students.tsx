import { toast } from '../../utils/toast';
import React, { useState, useEffect } from 'react';
import { FiPlus, FiSearch, FiEdit2, FiTrash2, FiDownload, FiX } from 'react-icons/fi';
import client from '../../api/client';
import { getInitials, formatDate } from '../../utils/helpers';

export default function Students() {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [classes, setClasses] = useState<any[]>([]);
  const [editStudent, setEditStudent] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [sections, setSections] = useState<any[]>([]);
  const emptyForm = {
    first_name: '', last_name: '', email: '', password: '1234',
    admission_no: '', section_id: '', roll_no: '',
    father_name: '', mother_name: '', aadhar_number: '',
    gender: '', phone: '', address: '',
    // Parent: either pick existing OR create new
    parent_mode: 'new' as 'new' | 'existing',
    parent_profile_id: '',
    parent_email: '', parent_first_name: '', parent_last_name: '',
    parent_phone: '', parent_relation: 'Father',
    parent_occupation: '', parent_address: '',
  };
  const [form, setForm] = useState({ ...emptyForm });
  const [parentSearch, setParentSearch] = useState('');
  const [parentSearchResults, setParentSearchResults] = useState<any[]>([]);
  const [linkedParents, setLinkedParents] = useState<any[]>([]);
  const [editingParent, setEditingParent] = useState<any>(null);

  useEffect(() => {
    fetchStudents();
    client.get('/classes').then(r => {
      const cls = r.data || [];
      setClasses(cls);
      Promise.all(cls.map((c: any) =>
        client.get(`/classes/${c.id}/sections`).then(sr => (sr.data || []).map((s: any) => ({ ...s, class_name: c.name }))).catch(() => [])
      )).then(results => setSections(results.flat()));
    }).catch(() => {});
  }, []);

  const fetchStudents = () => {
    client.get('/students').then(res => {
      setStudents(Array.isArray(res.data) ? res.data : res.data.students || []);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editStudent) {
        // Update existing student
        const patch: any = {
          first_name: form.first_name, last_name: form.last_name,
          roll_no: form.roll_no || undefined, section_id: form.section_id || undefined,
          father_name: form.father_name || undefined, mother_name: form.mother_name || undefined,
          aadhar_number: form.aadhar_number || undefined, gender: form.gender || undefined,
          phone: form.phone || undefined, address: form.address || undefined,
        };
        await client.patch(`/students/${editStudent.id}`, patch);
      } else {
        const payload: any = { ...form };
        // Parent mode handling
        if (form.parent_mode === 'existing') {
          if (!form.parent_profile_id) { toast.error('Please select an existing parent or switch to "Create New".'); return; }
          // Only send the link id; strip new-parent fields
          delete payload.parent_email; delete payload.parent_first_name; delete payload.parent_last_name;
          delete payload.parent_phone; delete payload.parent_occupation; delete payload.parent_address;
        } else {
          if (!form.parent_email || !form.parent_phone) { toast.error('Parent email and phone are required.'); return; }
          if (!form.parent_first_name || !form.parent_last_name) { toast.error('Parent first and last name are required.'); return; }
          delete payload.parent_profile_id;
        }
        delete payload.parent_mode;
        if (!payload.aadhar_number) delete payload.aadhar_number;
        if (!payload.section_id) delete payload.section_id;
        await client.post('/students', payload);
      }
      setShowModal(false);
      setEditStudent(null);
      setForm({ ...emptyForm });
      fetchStudents();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Error saving student');
    }
  };

  const f = (field: string, val: string) => setForm(prev => ({ ...prev, [field]: val }));

  const openEdit = async (s: any) => {
    setEditStudent(s);
    setForm({
      ...emptyForm,
      first_name: s.first_name || '', last_name: s.last_name || '',
      email: s.email || '', admission_no: s.admission_no || '',
      roll_no: s.roll_no || '', section_id: s.section_id || '',
      father_name: s.father_name || '', mother_name: s.mother_name || '',
      aadhar_number: s.aadhar_number || '', gender: s.gender || '',
      phone: s.phone || '', address: s.address || '',
    });
    // Load linked parents + their children counts
    try {
      const r = await client.get(`/students/${s.id}/parents`);
      const parentsList = r.data || [];
      // Fetch children-count for each linked parent
      const enriched = await Promise.all(parentsList.map(async (p: any) => {
        try {
          const cr = await client.get(`/admin/parents/${p.parent_profile_id}/children`);
          return { ...p, children_count: (cr.data || []).length };
        } catch { return { ...p, children_count: 1 }; }
      }));
      setLinkedParents(enriched);
    } catch { setLinkedParents([]); }
    setShowModal(true);
  };

  const searchParents = async (q: string) => {
    setParentSearch(q);
    if (!q.trim()) { setParentSearchResults([]); return; }
    try {
      const r = await client.get('/admin/parents/search', { params: { q } });
      setParentSearchResults(r.data || []);
    } catch { setParentSearchResults([]); }
  };

  const pickExistingParent = (p: any) => {
    setForm(prev => ({ ...prev, parent_profile_id: p.id }));
    setParentSearch(`${p.first_name} ${p.last_name} (${p.phone})`);
    setParentSearchResults([]);
  };

  const saveParentEdits = async () => {
    if (!editingParent) return;
    try {
      await client.patch(`/admin/parents/${editingParent.parent_profile_id || editingParent.id}`, {
        first_name: editingParent.first_name,
        last_name: editingParent.last_name,
        email: editingParent.email,
        phone: editingParent.phone,
        occupation: editingParent.occupation,
        address: editingParent.address,
        relation: editingParent.relation,
      });
      // Reload linked parents
      if (editStudent) {
        const r = await client.get(`/students/${editStudent.id}/parents`);
        setLinkedParents(r.data || []);
      }
      setEditingParent(null);
    } catch (err: any) { toast.error(err?.response?.data?.detail || 'Error'); }
  };

  const unlinkParent = async (parentId: string) => {
    if (!editStudent) return;
    if (!confirm('Unlink this parent from the student?')) return;
    await client.delete(`/admin/parents/${parentId}/unlink-student/${editStudent.id}`).catch(() => {});
    const r = await client.get(`/students/${editStudent.id}/parents`);
    setLinkedParents(r.data || []);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await client.delete(`/students/${deleteId}`).catch(() => {});
    setDeleteId(null);
    fetchStudents();
  };

  const classNameForSection = (sectionId: string) => {
    const sec = sections.find(s => s.id === sectionId);
    return sec ? `${sec.class_name} - ${sec.name}` : '—';
  };

  const exportCSV = () => {
    const rows = [
      ['Name', 'Admission No', 'Class/Section', 'Father', 'Mother', 'Phone', 'Email', 'Gender', 'Address'],
      ...filtered.map(s => [
        `${s.first_name || ''} ${s.last_name || ''}`.trim(),
        s.admission_no || '',
        classNameForSection(s.section_id),
        s.father_name || '',
        s.mother_name || '',
        s.phone || '',
        s.email || '',
        s.gender || '',
        (s.address || '').replace(/,/g, ' '),
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'students.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = students.filter(s => {
    const nameMatch = `${s.first_name || ''} ${s.last_name || ''} ${s.email || ''} ${s.admission_no || ''}`.toLowerCase().includes(search.toLowerCase());
    if (!nameMatch) return false;
    if (!classFilter) return true;
    const sec = sections.find(sec => sec.id === s.section_id);
    return sec && sec.class_id === classFilter;
  });

  const avatarColors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9'];

  return (
    <div>
      <div className="page-header">
        <h1>👨‍🎓 Students</h1>
        <div className="actions">
          <button className="btn btn-secondary btn-sm" onClick={exportCSV}><FiDownload /> Export</button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)} style={{ width: 'auto' }}>
            <FiPlus /> Add Student
          </button>
        </div>
      </div>

      <div className="filter-bar">
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <FiSearch style={{ position: 'absolute', left: '.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
          <input
            type="text"
            placeholder="Search students..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: '2.2rem', width: '100%' }}
          />
        </div>
        <select
          value={classFilter}
          onChange={e => setClassFilter(e.target.value)}
          style={{ minWidth: 160 }}
        >
          <option value="">All Classes</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="card">
        <div className="card-body no-padding">
          {loading ? (
            <div className="spinner-container"><div className="spinner" /></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <h3>No students found</h3>
              <p>Add your first student to get started</p>
            </div>
          ) : (
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Admission No</th>
                    <th>Class / Section</th>
                    <th>Father</th>
                    <th>Phone</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s, i) => (
                    <tr key={s.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="avatar" style={{ background: avatarColors[i % avatarColors.length] }}>
                            {getInitials(`${s.first_name || ''} ${s.last_name || ''}`)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700 }}>{s.first_name} {s.last_name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>{s.email || '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td><span className="badge badge-primary">{s.admission_no || '—'}</span></td>
                      <td style={{ fontSize: '0.85rem' }}>{classNameForSection(s.section_id)}</td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--gray-600)' }}>{s.father_name || '—'}</td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--gray-500)' }}>{s.phone || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn-icon" title="Edit" onClick={() => openEdit(s)}><FiEdit2 size={14} /></button>
                          <button className="btn-icon" title="Delete" style={{ color: 'var(--danger-500)' }} onClick={() => setDeleteId(s.id)}><FiTrash2 size={14} /></button>
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

      {/* Add Student Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h3>{editStudent ? 'Edit Student' : 'Add New Student'}</h3>
              <button className="btn-icon" onClick={() => { setShowModal(false); setEditStudent(null); }}><FiX /></button>
            </div>
            <form onSubmit={handleSubmit} autoComplete="off">
              {/* Hidden honeypot to defeat browser autofill */}
              <input type="text" name="prevent_autofill" autoComplete="off" style={{ display: 'none' }} />
              <input type="password" name="prevent_autofill_pw" autoComplete="new-password" style={{ display: 'none' }} />
              <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary-600)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>Student Info</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group"><label>First Name *</label><input className="form-input" required value={form.first_name} onChange={e => f('first_name', e.target.value)} /></div>
                  <div className="form-group"><label>Last Name *</label><input className="form-input" required value={form.last_name} onChange={e => f('last_name', e.target.value)} /></div>
                  <div className="form-group"><label>Father's Name</label><input className="form-input" placeholder="Father's full name" value={form.father_name} onChange={e => f('father_name', e.target.value)} /></div>
                  <div className="form-group"><label>Mother's Name</label><input className="form-input" placeholder="Mother's full name" value={form.mother_name} onChange={e => f('mother_name', e.target.value)} /></div>
                  <div className="form-group"><label>Aadhar Number</label><input className="form-input" placeholder="12-digit Aadhar" maxLength={12} pattern="\d{12}" value={form.aadhar_number} onChange={e => f('aadhar_number', e.target.value.replace(/\D/g,''))} /></div>
                  <div className="form-group">
                    <label>Gender</label>
                    <select className="form-input" value={form.gender} onChange={e => f('gender', e.target.value)}>
                      <option value="">Select...</option>
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div className="form-group"><label>Phone</label><input className="form-input" placeholder="Contact number" value={form.phone} onChange={e => f('phone', e.target.value)} /></div>
                  <div className="form-group"><label>Admission No *</label><input className="form-input" required value={form.admission_no} onChange={e => f('admission_no', e.target.value)} /></div>
                  <div className="form-group"><label>Roll No</label><input className="form-input" value={form.roll_no} onChange={e => f('roll_no', e.target.value)} /></div>
                  <div className="form-group">
                    <label>Section</label>
                    <select className="form-input" value={form.section_id} onChange={e => f('section_id', e.target.value)}>
                      <option value="">Select section...</option>
                      {sections.map((s: any) => <option key={s.id} value={s.id}>{s.class_name} — {s.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group" style={{ marginTop: '0.25rem' }}>
                  <label>Address</label>
                  <textarea className="form-input" rows={2} placeholder="Full address" value={form.address} onChange={e => f('address', e.target.value)} />
                </div>

                <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--success-600)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '1rem 0 0.75rem' }}>Account Login</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group"><label>Email *</label><input className="form-input" type="email" name="student_email" autoComplete="off" required value={form.email} onChange={e => f('email', e.target.value)} /></div>
                  <div className="form-group"><label>Password *</label><input className="form-input" type="password" name="student_password" autoComplete="new-password" required value={form.password} onChange={e => f('password', e.target.value)} /></div>
                </div>

                <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-600)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '1rem 0 0.75rem' }}>
                  Parent Account *
                </p>

                {editStudent ? (
                  /* ── Edit mode: show linked parents ─────────────────────── */
                  <div>
                    {linkedParents.length === 0 ? (
                      <p style={{ fontSize: '0.82rem', color: 'var(--gray-500)' }}>No parents linked. (Link from the Parents tab.)</p>
                    ) : linkedParents.map((p: any) => (
                      <div key={p.parent_profile_id} style={{ padding: 12, border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-md)', marginBottom: 8 }}>
                        {editingParent?.parent_profile_id === p.parent_profile_id ? (
                          <div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                              <input className="form-input" placeholder="First name" value={editingParent.first_name || ''} onChange={e => setEditingParent({ ...editingParent, first_name: e.target.value })} />
                              <input className="form-input" placeholder="Last name" value={editingParent.last_name || ''} onChange={e => setEditingParent({ ...editingParent, last_name: e.target.value })} />
                              <input className="form-input" type="email" placeholder="Email" value={editingParent.email || ''} onChange={e => setEditingParent({ ...editingParent, email: e.target.value })} />
                              <input className="form-input" placeholder="Phone" value={editingParent.phone || ''} onChange={e => setEditingParent({ ...editingParent, phone: e.target.value })} />
                              <input className="form-input" placeholder="Occupation" value={editingParent.occupation || ''} onChange={e => setEditingParent({ ...editingParent, occupation: e.target.value })} />
                              <select className="form-input" value={editingParent.relation || 'Father'} onChange={e => setEditingParent({ ...editingParent, relation: e.target.value })}>
                                <option value="Father">Father</option><option value="Mother">Mother</option><option value="Guardian">Guardian</option>
                              </select>
                            </div>
                            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                              <button type="button" className="btn btn-primary btn-sm" onClick={saveParentEdits}>Save</button>
                              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingParent(null)}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                            <div style={{ fontSize: '0.85rem' }}>
                              <div style={{ fontWeight: 700 }}>
                                {p.first_name} {p.last_name}
                                <span className="badge badge-neutral" style={{ marginLeft: 6 }}>{p.relation}</span>
                                {p.children_count > 1 && (
                                  <span className="badge" style={{ marginLeft: 6, background: '#fef3c7', color: '#92400e', fontSize: '0.68rem' }}>
                                    Shared — {p.children_count} children
                                  </span>
                                )}
                              </div>
                              <div style={{ color: 'var(--gray-500)', marginTop: 2 }}>📧 {p.email}</div>
                              <div style={{ color: 'var(--gray-500)' }}>📞 {p.phone || '—'}</div>
                              {p.occupation && <div style={{ color: 'var(--gray-500)' }}>{p.occupation}</div>}
                              {p.children_count > 1 && (
                                <div style={{ marginTop: 4, fontSize: '0.72rem', color: '#92400e', background: '#fef3c7', padding: '4px 8px', borderRadius: 4 }}>
                                  ⚠ Edits here apply to all {p.children_count} siblings linked to this parent.
                                </div>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button type="button" className="btn-icon" title="Edit" onClick={() => setEditingParent(p)}><FiEdit2 size={13} /></button>
                              <button type="button" className="btn-icon" title="Unlink" style={{ color: 'var(--danger-500)' }} onClick={() => unlinkParent(p.parent_profile_id)}><FiX size={13} /></button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  /* ── Add mode: link existing OR create new ──────────────── */
                  <div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}>
                        <input type="radio" checked={form.parent_mode === 'new'} onChange={() => setForm(p => ({ ...p, parent_mode: 'new' }))} />
                        Create new parent
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}>
                        <input type="radio" checked={form.parent_mode === 'existing'} onChange={() => setForm(p => ({ ...p, parent_mode: 'existing' }))} />
                        Link existing (sibling)
                      </label>
                    </div>

                    {form.parent_mode === 'existing' ? (
                      <div style={{ position: 'relative' }}>
                        <input
                          className="form-input"
                          placeholder="Search parent by name / phone / email..."
                          value={parentSearch}
                          onChange={e => { searchParents(e.target.value); f('parent_profile_id', ''); }}
                        />
                        {parentSearchResults.length > 0 && (
                          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-md)', maxHeight: 200, overflowY: 'auto', marginTop: 4, boxShadow: 'var(--shadow-md)' }}>
                            {parentSearchResults.map((p: any) => (
                              <div key={p.id} onClick={() => pickExistingParent(p)} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--gray-100)' }}>
                                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{p.first_name} {p.last_name}</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--gray-500)' }}>{p.email} • {p.phone} • {p.children_count} child(ren)</div>
                              </div>
                            ))}
                          </div>
                        )}
                        {form.parent_profile_id && <p style={{ fontSize: '0.72rem', color: 'var(--success-600)', marginTop: 4 }}>✓ Existing parent selected</p>}
                        <div className="form-group" style={{ marginTop: 8 }}>
                          <label>Relation</label>
                          <select className="form-input" value={form.parent_relation} onChange={e => f('parent_relation', e.target.value)}>
                            <option value="Father">Father</option><option value="Mother">Mother</option><option value="Guardian">Guardian</option>
                          </select>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <div className="form-group"><label>Parent First Name *</label><input className="form-input" required={form.parent_mode === 'new'} value={form.parent_first_name} onChange={e => f('parent_first_name', e.target.value)} /></div>
                        <div className="form-group"><label>Parent Last Name *</label><input className="form-input" required={form.parent_mode === 'new'} value={form.parent_last_name} onChange={e => f('parent_last_name', e.target.value)} /></div>
                        <div className="form-group"><label>Parent Email *</label><input className="form-input" type="email" name="parent_email_new" autoComplete="off" required={form.parent_mode === 'new'} placeholder="login email" value={form.parent_email} onChange={e => f('parent_email', e.target.value)} /></div>
                        <div className="form-group"><label>Parent Phone *</label><input className="form-input" required={form.parent_mode === 'new'} placeholder="WhatsApp number" value={form.parent_phone} onChange={e => f('parent_phone', e.target.value)} /></div>
                        <div className="form-group"><label>Occupation</label><input className="form-input" value={form.parent_occupation} onChange={e => f('parent_occupation', e.target.value)} /></div>
                        <div className="form-group">
                          <label>Relation</label>
                          <select className="form-input" value={form.parent_relation} onChange={e => f('parent_relation', e.target.value)}>
                            <option value="Father">Father</option><option value="Mother">Mother</option><option value="Guardian">Guardian</option>
                          </select>
                        </div>
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>Parent Address</label><input className="form-input" value={form.parent_address} onChange={e => f('parent_address', e.target.value)} /></div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => { setShowModal(false); setEditStudent(null); }}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ width: 'auto' }}>{editStudent ? 'Save Changes' : 'Add Student'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <div className="modal-header"><h3>Delete Student</h3><button className="btn-icon" onClick={() => setDeleteId(null)}><FiX /></button></div>
            <div className="modal-body"><p>This will permanently delete the student and their account. Cannot be undone.</p></div>
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
