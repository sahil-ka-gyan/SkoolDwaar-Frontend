import { toast } from '../../utils/toast';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPlus, FiSearch, FiEdit2, FiTrash2, FiShield, FiDownload } from 'react-icons/fi';
import client from '../../api/client';
import { getInitials, formatINR } from '../../utils/helpers';

export default function Teachers() {
  const navigate = useNavigate();
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [classes, setClasses] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const emptyForm = {
    first_name: '', last_name: '', email: '', password: '1234',
    qualification: '', department: '', phone: '',
    aadhar_number: '', gender: '', salary: '', join_date: '', address: '', dob: '',
  };
  const [form, setForm] = useState({ ...emptyForm });
  const [editTeacher, setEditTeacher] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const f = (field: string, val: string) => setForm(prev => ({ ...prev, [field]: val }));

  const toggleSubject = (id: string) => {
    setSelectedSubjectIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const openEdit = (t: any) => {
    setEditTeacher(t);
    setForm({
      ...emptyForm,
      first_name: t.first_name || '', last_name: t.last_name || '',
      email: t.email || '',
      qualification: t.qualification || '', department: t.department || '',
      phone: t.phone || '', aadhar_number: t.aadhar_number || '',
      gender: t.gender || '', salary: t.salary ? String(t.salary) : '',
      join_date: t.join_date || '', address: t.address || '', dob: t.dob || '',
    });
    setSelectedSubjectIds(t.subject_ids || []);
    setShowModal(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await client.delete(`/staff/${deleteId}`).catch(() => {});
    setDeleteId(null);
    fetchTeachers();
  };

  useEffect(() => {
    fetchTeachers();
    client.get('/subjects').then(r => setSubjects(r.data || [])).catch(() => {});
    client.get('/classes').then(r => setClasses(r.data || [])).catch(() => {});
  }, []);

  const subjectLabels = (ids: string[]) =>
    (ids || []).map(id => {
      const s = subjects.find((x: any) => x.id === id);
      if (!s) return null;
      return s.class_name ? `${s.name} · ${s.class_name}` : s.name;
    }).filter(Boolean);

  // Deduplicated by subject name for table compactness (Maths × 3 classes → "Maths (3)")
  const subjectSummary = (ids: string[]) => {
    const counts: Record<string, number> = {};
    (ids || []).forEach(id => {
      const s = subjects.find((x: any) => x.id === id);
      if (s) counts[s.name] = (counts[s.name] || 0) + 1;
    });
    return Object.entries(counts).map(([n, c]) => c > 1 ? `${n} (${c})` : n);
  };

  const fetchTeachers = () => {
    client.get('/staff').then(res => {
      setTeachers(Array.isArray(res.data) ? res.data : res.data.teachers || []);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = { ...form, subject_ids: selectedSubjectIds };
      if (payload.salary) payload.salary = parseFloat(payload.salary);
      else delete payload.salary;
      if (!payload.aadhar_number) delete payload.aadhar_number;
      if (!payload.dob) delete payload.dob;
      if (!payload.join_date) delete payload.join_date;
      delete payload.employee_id; // always auto-generated

      if (editTeacher) {
        delete payload.email; delete payload.password;
        await client.patch(`/staff/${editTeacher.id}`, payload);
      } else {
        await client.post('/staff', payload);
      }
      setShowModal(false);
      setEditTeacher(null);
      setForm({ ...emptyForm });
      setSelectedSubjectIds([]);
      fetchTeachers();
    } catch (err: any) { toast.error(err?.response?.data?.detail || 'Error'); }
  };

  // Subject IDs belonging to the selected class — for class filter
  const classSubjectIds = classFilter
    ? new Set(subjects.filter((s: any) => s.class_id === classFilter).map((s: any) => s.id))
    : null;

  const filtered = teachers.filter(t => {
    const q = `${t.first_name || ''} ${t.last_name || ''} ${t.email || ''} ${t.employee_id || ''}`.toLowerCase();
    if (search && !q.includes(search.toLowerCase())) return false;
    if (classSubjectIds) {
      const has = (t.subject_ids || []).some((sid: string) => classSubjectIds.has(sid));
      if (!has) return false;
    }
    return true;
  });

  const exportCSV = () => {
    const rows = [
      ['Name', 'Employee ID', 'Email', 'Department', 'Qualification', 'Salary', 'Phone', 'Join Date', 'Status'],
      ...filtered.map(t => [
        `${t.first_name || ''} ${t.last_name || ''}`.trim(),
        t.employee_id || '',
        t.email || '',
        t.department || '',
        t.qualification || '',
        t.salary || '',
        t.phone || '',
        t.join_date || '',
        t.is_active !== false ? 'Active' : 'Inactive',
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'teachers.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const colors = ['#10b981', '#6366f1', '#f59e0b', '#0ea5e9', '#8b5cf6', '#ef4444'];

  return (
    <div>
      <div className="page-header">
        <h1>👩‍🏫 Teachers</h1>
        <div className="actions">
          <button className="btn btn-secondary btn-sm" onClick={exportCSV}><FiDownload /> Export</button>
          <button className="btn btn-primary btn-sm" onClick={() => { setEditTeacher(null); setForm({ ...emptyForm }); setSelectedSubjectIds([]); setShowModal(true); }} style={{ width: 'auto' }}>
            <FiPlus /> Add Teacher
          </button>
        </div>
      </div>

      <div className="filter-bar" style={{ gap: 8, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <FiSearch style={{ position: 'absolute', left: '.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
          <input type="text" placeholder="Search teachers..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: '2.2rem', width: '100%' }} />
        </div>
        <select value={classFilter} onChange={e => setClassFilter(e.target.value)} style={{ minWidth: 180 }}>
          <option value="">All Classes</option>
          {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {classFilter && (
          <button className="btn btn-secondary btn-sm" onClick={() => setClassFilter('')}>Clear</button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--gray-500)', alignSelf: 'center' }}>
          {filtered.length} teacher{filtered.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="card">
        <div className="card-body no-padding">
          {loading ? (
            <div className="spinner-container"><div className="spinner" /></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <h3>No teachers found</h3>
              <p>Add your first teacher to get started</p>
            </div>
          ) : (
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead><tr><th>Teacher</th><th>Employee ID</th><th>Department</th><th>Subjects</th><th>Salary</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {filtered.map((t, i) => (
                    <tr key={t.id || i}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="avatar" style={{ background: colors[i % colors.length] }}>{getInitials(`${t.first_name || ''} ${t.last_name || ''}`)}</div>
                          <div>
                            <div style={{ fontWeight: 700 }}>{t.first_name} {t.last_name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>{t.email || '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td><span className="badge badge-info">{t.employee_id || '—'}</span></td>
                      <td className="text-sm text-muted">{t.department || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, maxWidth: 200 }}>
                          {subjectSummary(t.subject_ids).length === 0
                            ? <span style={{ color: 'var(--gray-300)', fontSize: '0.8rem' }}>—</span>
                            : subjectSummary(t.subject_ids).map((n: string, i: number) => (
                                <span key={i} className="badge" style={{ background: 'var(--primary-50)', color: 'var(--primary-600)', fontSize: '0.68rem' }}>{n}</span>
                              ))}
                        </div>
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--success-600)' }}>{t.salary ? formatINR(t.salary) : '—'}</td>
                      <td>
                        <span className="badge" style={{ background: t.is_active !== false ? 'var(--success-50)' : 'var(--danger-50)', color: t.is_active !== false ? 'var(--success-600)' : 'var(--danger-600)' }}>
                          <span className="status-dot" style={{ background: t.is_active !== false ? 'var(--success-500)' : 'var(--danger-500)' }} />
                          {t.is_active !== false ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-1">
                          <button className="btn-icon" title="Permissions" style={{ color: 'var(--primary-600)' }} onClick={() => navigate(`/admin/teachers/${t.id}/permissions`)}><FiShield /></button>
                          <button className="btn-icon" title="Edit" onClick={() => openEdit(t)}><FiEdit2 /></button>
                          <button className="btn-icon" title="Delete" style={{ color: 'var(--danger-500)' }} onClick={() => setDeleteId(t.id)}><FiTrash2 /></button>
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
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-header"><h3>{editTeacher ? 'Edit Teacher' : 'Add New Teacher'}</h3><button className="btn-icon" onClick={() => setShowModal(false)}>✕</button></div>
            <form onSubmit={handleSubmit} autoComplete="off">
              <input type="text" name="prevent_autofill" autoComplete="off" style={{ display: 'none' }} />
              <input type="password" name="prevent_autofill_pw" autoComplete="new-password" style={{ display: 'none' }} />
              <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary-600)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>Personal Info</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group"><label>First Name *</label><input className="form-input" required value={form.first_name} onChange={e => f('first_name', e.target.value)} /></div>
                  <div className="form-group"><label>Last Name *</label><input className="form-input" required value={form.last_name} onChange={e => f('last_name', e.target.value)} /></div>
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
                  <div className="form-group"><label>Date of Birth</label><input className="form-input" type="date" value={form.dob} onChange={e => f('dob', e.target.value)} /></div>
                  <div className="form-group"><label>Phone</label><input className="form-input" value={form.phone} onChange={e => f('phone', e.target.value)} /></div>
                </div>
                <div className="form-group"><label>Address</label><textarea className="form-input" rows={2} value={form.address} onChange={e => f('address', e.target.value)} /></div>

                <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--success-600)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '1rem 0 0.75rem' }}>Employment</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group"><label>Department</label><input className="form-input" value={form.department} onChange={e => f('department', e.target.value)} /></div>
                  <div className="form-group"><label>Qualification</label><input className="form-input" value={form.qualification} onChange={e => f('qualification', e.target.value)} /></div>
                  <div className="form-group"><label>Monthly Salary (₹)</label><input className="form-input" type="number" min="0" value={form.salary} onChange={e => f('salary', e.target.value)} /></div>
                  <div className="form-group"><label>Join Date</label><input className="form-input" type="date" value={form.join_date} onChange={e => f('join_date', e.target.value)} /></div>
                </div>

                {/* Assigned subjects */}
                <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary-600)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '1rem 0 0.5rem' }}>Assigned Subjects</p>
                <p style={{ fontSize: '0.74rem', color: 'var(--gray-400)', marginBottom: 8 }}>Teacher can only create exam papers for the subjects selected here.</p>
                {subjects.length === 0 ? (
                  <p style={{ fontSize: '0.82rem', color: 'var(--gray-400)' }}>No subjects yet. Add subjects from the Subjects page first.</p>
                ) : (
                  (() => {
                    // Group subjects by class for clarity
                    const grouped: Record<string, any[]> = {};
                    subjects.forEach((s: any) => {
                      const cls = s.class_name || 'Other';
                      (grouped[cls] = grouped[cls] || []).push(s);
                    });
                    const classOrder = Object.keys(grouped).sort();
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 280, overflowY: 'auto', padding: '2px 4px' }}>
                        {classOrder.map(cls => (
                          <div key={cls}>
                            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{cls}</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {grouped[cls].map((s: any) => {
                                const active = selectedSubjectIds.includes(s.id);
                                return (
                                  <button
                                    type="button" key={s.id} onClick={() => toggleSubject(s.id)}
                                    style={{
                                      padding: '4px 10px', borderRadius: 'var(--radius-full)', cursor: 'pointer',
                                      fontSize: '0.74rem', fontWeight: 600,
                                      border: '1.5px solid ' + (active ? 'var(--primary-500)' : 'var(--gray-200)'),
                                      background: active ? 'var(--primary-500)' : '#fff',
                                      color: active ? '#fff' : 'var(--gray-600)',
                                    }}
                                  >
                                    {active ? '✓ ' : ''}{s.name}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()
                )}

                {!editTeacher && (
                  <>
                    <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-600)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '1rem 0 0.75rem' }}>Account Login</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div className="form-group"><label>Email *</label><input className="form-input" type="email" name="teacher_email" autoComplete="off" required value={form.email} onChange={e => f('email', e.target.value)} /></div>
                      <div className="form-group">
                        <label>Password</label>
                        <input className="form-input" type="text" name="teacher_password_new" autoComplete="new-password" value={form.password} onChange={e => f('password', e.target.value)} placeholder="Default: 1234" />
                        <p style={{ fontSize: '0.72rem', color: 'var(--gray-400)', marginTop: 3 }}>Employee ID is auto-generated (T0001, T0002…)</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => { setShowModal(false); setEditTeacher(null); }}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ width: 'auto' }}>{editTeacher ? 'Save Changes' : 'Add Teacher'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <div className="modal-header"><h3>Delete Teacher</h3><button className="btn-icon" onClick={() => setDeleteId(null)}>✕</button></div>
            <div className="modal-body"><p>This will permanently delete the teacher and their account. Cannot be undone.</p></div>
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
