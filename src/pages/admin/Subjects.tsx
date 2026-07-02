import { toast } from '../../utils/toast';
import React, { useEffect, useMemo, useState } from 'react';
import { FiSearch, FiBook, FiPlus, FiEdit2, FiTrash2, FiX, FiFileText, FiExternalLink } from 'react-icons/fi';
import client from '../../api/client';
import { formatDate } from '../../utils/helpers';

export default function Subjects() {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [selected, setSelected] = useState<any>(null);

  const [syllabusItems, setSyllabusItems] = useState<any[]>([]);
  const [syllLoading, setSyllLoading] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({ title: '', content: '', file_url: '', class_id: '' });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      client.get('/subjects').then(r => setSubjects(r.data || [])).catch(() => {}),
      client.get('/classes').then(r => setClasses(r.data || [])).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const classNameById = (id: string) => classes.find((c: any) => c.id === id)?.name || id;

  const filtered = useMemo(() => {
    let list = subjects;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s => `${s.name || ''} ${s.code || ''}`.toLowerCase().includes(q));
    }
    if (classFilter) {
      list = list.filter(s => (s.class_ids || []).includes(classFilter));
    }
    return list;
  }, [subjects, search, classFilter]);

  const loadSyllabus = async (subj: any) => {
    setSelected(subj);
    setSyllLoading(true);
    try {
      const r = await client.get(`/syllabus`, { params: { subject_id: subj.id } });
      setSyllabusItems(Array.isArray(r.data) ? r.data : []);
    } catch { setSyllabusItems([]); }
    setSyllLoading(false);
  };

  const openAdd = () => {
    if (!selected) return;
    setEditItem(null);
    setForm({ title: '', content: '', file_url: '', class_id: (selected.class_ids && selected.class_ids[0]) || '' });
    setShowModal(true);
  };

  const openEdit = (s: any) => {
    setEditItem(s);
    setForm({ title: s.title || '', content: s.content || '', file_url: s.file_url || '', class_id: s.class_id });
    setShowModal(true);
  };

  const saveSyllabus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    try {
      if (editItem) {
        const patch: any = { title: form.title };
        if (form.content) patch.content = form.content;
        if (form.file_url) patch.file_url = form.file_url;
        await client.patch(`/syllabus/${editItem.id}`, patch);
      } else {
        const payload: any = {
          title: form.title,
          class_id: form.class_id,
          subject_id: selected.id,
        };
        if (form.content) payload.content = form.content;
        if (form.file_url) payload.file_url = form.file_url;
        await client.post('/syllabus', payload);
      }
      setShowModal(false);
      await loadSyllabus(selected);
    } catch (err: any) { toast.error(err?.response?.data?.detail || 'Error saving syllabus'); }
    setSaving(false);
  };

  const doDelete = async () => {
    if (!deleteId) return;
    await client.delete(`/syllabus/${deleteId}`).catch(() => {});
    setDeleteId(null);
    if (selected) await loadSyllabus(selected);
  };

  return (
    <div>
      <div className="page-header"><h1>📚 Subjects & Syllabus</h1></div>

      {loading ? (
        <div className="card"><div className="spinner-container"><div className="spinner" /></div></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 16, alignItems: 'flex-start' }}>
          {/* Left — subjects list */}
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '14px 14px 12px', borderBottom: '1px solid var(--gray-100)' }}>
              {/* Header row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                  Subjects <span style={{ fontSize: '0.78rem', color: 'var(--gray-400)', fontWeight: 500 }}>({filtered.length})</span>
                </div>
                {(search || classFilter) && (
                  <button onClick={() => { setSearch(''); setClassFilter(''); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary-600)', fontSize: '0.74rem', fontWeight: 600, padding: 0 }}>
                    Clear
                  </button>
                )}
              </div>
              {/* Search */}
              <div style={{ position: 'relative', marginBottom: 8 }}>
                <FiSearch size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', pointerEvents: 'none' }} />
                <input
                  type="text"
                  placeholder="Search by name or code…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 36px',
                    fontSize: '0.85rem',
                    border: '1.5px solid var(--gray-200)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--gray-50)',
                    outline: 'none',
                    transition: 'all .15s',
                  }}
                  onFocus={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = 'var(--primary-400)'; }}
                  onBlur={e => { e.currentTarget.style.background = 'var(--gray-50)'; e.currentTarget.style.borderColor = 'var(--gray-200)'; }}
                />
              </div>
              {/* Class filter as pill row */}
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                <button
                  onClick={() => setClassFilter('')}
                  style={{
                    padding: '4px 10px', borderRadius: 'var(--radius-full)',
                    fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer',
                    border: '1.5px solid ' + (!classFilter ? 'var(--primary-500)' : 'var(--gray-200)'),
                    background: !classFilter ? 'var(--primary-50)' : '#fff',
                    color: !classFilter ? 'var(--primary-700)' : 'var(--gray-600)',
                  }}
                >
                  All Classes
                </button>
                {classes.map((c: any) => {
                  const active = classFilter === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setClassFilter(c.id)}
                      style={{
                        padding: '4px 10px', borderRadius: 'var(--radius-full)',
                        fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer',
                        border: '1.5px solid ' + (active ? 'var(--primary-500)' : 'var(--gray-200)'),
                        background: active ? 'var(--primary-50)' : '#fff',
                        color: active ? 'var(--primary-700)' : 'var(--gray-600)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
              {/* Hidden select kept for accessibility / fallback */}
              <select value={classFilter} onChange={e => setClassFilter(e.target.value)} style={{ display: 'none' }}>
                <option value="">All Classes</option>
                {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ maxHeight: 'calc(100vh - 240px)', overflowY: 'auto' }}>
              {filtered.length === 0 ? (
                <p style={{ padding: 16, color: 'var(--gray-400)', fontSize: '0.85rem', textAlign: 'center' }}>
                  No subjects found. Add subjects from the Classes page.
                </p>
              ) : filtered.map((s: any) => (
                <div key={s.id} onClick={() => loadSyllabus(s)} style={{
                  padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--gray-100)',
                  background: selected?.id === s.id ? 'var(--primary-50)' : 'transparent',
                  borderLeft: selected?.id === s.id ? '3px solid var(--primary-500)' : '3px solid transparent',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FiBook size={14} style={{ color: 'var(--success-600)' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{s.name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--gray-400)' }}>
                        {s.code && <span>{s.code}</span>}
                        {s.code && (s.class_ids || []).length > 0 && <span> • </span>}
                        {(s.class_ids || []).map((cid: string) => classNameById(cid)).join(', ')}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — syllabus */}
          <div>
            {!selected ? (
              <div className="card"><div className="empty-state">
                <FiBook size={32} style={{ color: 'var(--gray-300)' }} />
                <h3>Select a subject</h3>
                <p>Pick a subject from the left to view and manage its syllabus</p>
              </div></div>
            ) : (
              <div className="card">
                <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{selected.name} {selected.code && <span style={{ fontSize: '0.78rem', color: 'var(--gray-400)', fontWeight: 400 }}>({selected.code})</span>}</h2>
                    <div style={{ fontSize: '0.78rem', color: 'var(--gray-500)', marginTop: 3 }}>
                      Classes: {(selected.class_ids || []).map((cid: string) => classNameById(cid)).join(', ') || '—'}
                    </div>
                  </div>
                  <button className="btn btn-primary btn-sm" style={{ width: 'auto' }} onClick={openAdd}>
                    <FiPlus /> Add Syllabus Entry
                  </button>
                </div>
                <div className="card-body no-padding">
                  {syllLoading ? (
                    <div className="spinner-container"><div className="spinner" /></div>
                  ) : syllabusItems.length === 0 ? (
                    <div className="empty-state">
                      <FiFileText size={32} style={{ color: 'var(--gray-300)' }} />
                      <h3>No syllabus added yet</h3>
                      <p>Click "Add Syllabus Entry" to create chapters, units, or upload a syllabus PDF</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {syllabusItems.map((s: any) => (
                        <div key={s.id} style={{ padding: '14px 16px', borderBottom: '1px solid var(--gray-100)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <h4 style={{ margin: 0, fontSize: '0.95rem' }}>{s.title}</h4>
                                <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>{classNameById(s.class_id)}</span>
                              </div>
                              {s.content && (
                                <p style={{ margin: '6px 0 0', fontSize: '0.85rem', color: 'var(--gray-600)', whiteSpace: 'pre-wrap' }}>{s.content}</p>
                              )}
                              {s.file_url && (
                                <a href={s.file_url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: '0.82rem', color: 'var(--primary-600)' }}>
                                  <FiExternalLink size={12} /> View attached file
                                </a>
                              )}
                              <div style={{ fontSize: '0.7rem', color: 'var(--gray-400)', marginTop: 6 }}>Added {formatDate(s.created_at)}</div>
                            </div>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button className="btn-icon" onClick={() => openEdit(s)}><FiEdit2 size={14} /></button>
                              <button className="btn-icon" style={{ color: 'var(--danger-500)' }} onClick={() => setDeleteId(s.id)}><FiTrash2 size={14} /></button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add/Edit syllabus modal */}
      {showModal && selected && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3>{editItem ? 'Edit Syllabus Entry' : `Add Syllabus — ${selected.name}`}</h3>
              <button className="btn-icon" onClick={() => setShowModal(false)}><FiX /></button>
            </div>
            <form onSubmit={saveSyllabus}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Title *</label>
                  <input className="form-input" required placeholder="e.g. Chapter 1 — Real Numbers"
                    value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
                </div>
                {!editItem && (
                  <div className="form-group">
                    <label>Class *</label>
                    <select className="form-input" required value={form.class_id} onChange={e => setForm(p => ({ ...p, class_id: e.target.value }))}>
                      <option value="">Select class...</option>
                      {(selected.class_ids || []).length > 0
                        ? (selected.class_ids || []).map((cid: string) => <option key={cid} value={cid}>{classNameById(cid)}</option>)
                        : classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="form-group">
                  <label>Content / Topics</label>
                  <textarea className="form-input" rows={5} placeholder="Describe the chapter, units, learning objectives..."
                    value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Attachment URL (optional)</label>
                  <input className="form-input" type="url" placeholder="https://..."
                    value={form.file_url} onChange={e => setForm(p => ({ ...p, file_url: e.target.value }))} />
                  <p style={{ fontSize: '0.72rem', color: 'var(--gray-400)', marginTop: 3 }}>Link to PDF / Google Drive / any external file</p>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ width: 'auto' }}>{saving ? 'Saving...' : (editItem ? 'Save' : 'Add Entry')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <div className="modal-header"><h3>Delete Syllabus Entry</h3><button className="btn-icon" onClick={() => setDeleteId(null)}><FiX /></button></div>
            <div className="modal-body"><p>Delete this syllabus entry? This cannot be undone.</p></div>
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
