import { toast } from '../../utils/toast';
import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiX, FiBook, FiUser, FiUserCheck } from 'react-icons/fi';
import client from '../../api/client';
import { getInitials } from '../../utils/helpers';
import SectionRosterPanel from '../../components/SectionRosterPanel';

export default function Classes() {
  const [classes, setClasses] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState<any>(null);

  // Per-class cached data
  const [classSections, setClassSections] = useState<Record<string, any[]>>({});
  const [classSubjects, setClassSubjects] = useState<Record<string, any[]>>({});
  const [detailLoading, setDetailLoading] = useState(false);

  // Class modal
  const [showClassModal, setShowClassModal] = useState(false);
  const [editClass, setEditClass] = useState<any>(null);
  const [classForm, setClassForm] = useState({ name: '', grade_level: '' });

  // Section modal
  const [showSecModal, setShowSecModal] = useState(false);
  const [secForm, setSecForm] = useState({ name: '' });

  // Subject modal
  const [showSubjModal, setShowSubjModal] = useState(false);
  const [subjForm, setSubjForm] = useState({ name: '', code: '' });

  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; type: 'class' | 'section' | 'subject'; classId?: string } | null>(null);

  // Class teacher assignment modal
  const [teacherModalSection, setTeacherModalSection] = useState<any>(null);
  const [teacherSearch, setTeacherSearch] = useState('');

  const teacherById = (id: string | null) => teachers.find((t: any) => t.id === id);

  useEffect(() => {
    fetchClasses();
    client.get('/staff').then(r => setTeachers(r.data || [])).catch(() => {});
  }, []);

  const setSectionTeacher = async (sectionId: string, teacherProfileId: string) => {
    try {
      await client.patch(`/sections/${sectionId}`, { class_teacher_id: teacherProfileId || null });
      if (selectedClass) {
        const r = await client.get(`/classes/${selectedClass.id}/sections`);
        setClassSections(prev => ({ ...prev, [selectedClass.id]: r.data || [] }));
      }
    } catch (err: any) { toast.error(err?.response?.data?.detail || 'Error'); }
  };

  const teacherName = (teacherProfileId: string | null) => {
    if (!teacherProfileId) return null;
    const t = teachers.find((tt: any) => tt.id === teacherProfileId);
    return t ? `${t.first_name} ${t.last_name}` : null;
  };

  const fetchClasses = async () => {
    setLoading(true);
    const r = await client.get('/classes').catch(() => ({ data: [] }));
    const list = Array.isArray(r.data) ? r.data : [];
    setClasses(list);
    setLoading(false);
    if (list.length > 0 && !selectedClass) {
      selectClass(list[0]);
    }
  };

  const selectClass = async (cls: any) => {
    setSelectedClass(cls);
    if (!classSections[cls.id] || !classSubjects[cls.id]) {
      setDetailLoading(true);
      await loadClassDetail(cls.id);
      setDetailLoading(false);
    }
  };

  const loadClassDetail = async (classId: string) => {
    const [secR, subjR] = await Promise.all([
      client.get(`/classes/${classId}/sections`).catch(() => ({ data: [] })),
      client.get(`/classes/${classId}/subjects`).catch(() => ({ data: [] })),
    ]);
    setClassSections(prev => ({ ...prev, [classId]: secR.data || [] }));
    setClassSubjects(prev => ({ ...prev, [classId]: subjR.data || [] }));
  };

  // ── Class CRUD ──────────────────────────────────────────────────────────────
  const openAddClass = () => { setClassForm({ name: '', grade_level: '' }); setEditClass(null); setShowClassModal(true); };
  const openEditClass = (e: React.MouseEvent, c: any) => { e.stopPropagation(); setClassForm({ name: c.name, grade_level: String(c.grade_level) }); setEditClass(c); setShowClassModal(true); };

  const saveClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { name: classForm.name, grade_level: classForm.grade_level !== '' ? parseInt(classForm.grade_level) : 0 };
      let saved: any;
      if (editClass) {
        const r = await client.patch(`/classes/${editClass.id}`, payload);
        saved = r.data;
        setClasses(prev => prev.map(c => c.id === editClass.id ? saved : c));
        if (selectedClass?.id === editClass.id) setSelectedClass(saved);
      } else {
        const r = await client.post('/classes', payload);
        saved = r.data;
        setClasses(prev => [...prev, saved]);
        selectClass(saved);
      }
      setShowClassModal(false);
    } catch (err: any) { toast.error(err?.response?.data?.detail || 'Error'); }
    setSaving(false);
  };

  const deleteClass = async (id: string) => {
    await client.delete(`/classes/${id}`).catch(() => {});
    setDeleteConfirm(null);
    const remaining = classes.filter(c => c.id !== id);
    setClasses(remaining);
    if (selectedClass?.id === id) {
      setSelectedClass(remaining[0] || null);
      if (remaining[0]) selectClass(remaining[0]);
    }
  };

  // ── Section CRUD ─────────────────────────────────────────────────────────────
  const saveSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass) return;
    setSaving(true);
    try {
      await client.post('/sections', { name: secForm.name, class_id: selectedClass.id });
      setShowSecModal(false);
      setSecForm({ name: '' });
      // Force-fetch fresh sections (bypasses stale closure guard)
      const r = await client.get(`/classes/${selectedClass.id}/sections`).catch(() => ({ data: [] }));
      setClassSections(prev => ({ ...prev, [selectedClass.id]: r.data || [] }));
    } catch (err: any) { toast.error(err?.response?.data?.detail || 'Error'); }
    setSaving(false);
  };

  const deleteSection = async (sectionId: string) => {
    if (!selectedClass) return;
    await client.delete(`/sections/${sectionId}`).catch(() => {});
    setClassSections(prev => ({ ...prev, [selectedClass.id]: (prev[selectedClass.id] || []).filter((s: any) => s.id !== sectionId) }));
    setDeleteConfirm(null);
  };

  // ── Subject CRUD ─────────────────────────────────────────────────────────────
  const saveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass) return;
    setSaving(true);
    try {
      const payload: any = { name: subjForm.name };
      if (subjForm.code) payload.code = subjForm.code;
      const r = await client.post(`/classes/${selectedClass.id}/subjects`, payload);
      setClassSubjects(prev => ({ ...prev, [selectedClass.id]: [...(prev[selectedClass.id] || []), r.data] }));
      setShowSubjModal(false);
      setSubjForm({ name: '', code: '' });
    } catch (err: any) { toast.error(err?.response?.data?.detail || 'Error'); }
    setSaving(false);
  };

  const deleteSubject = async (subjectId: string) => {
    if (!selectedClass) return;
    await client.delete(`/classes/${selectedClass.id}/subjects/${subjectId}`).catch(() => {});
    setClassSubjects(prev => ({ ...prev, [selectedClass.id]: (prev[selectedClass.id] || []).filter((s: any) => s.id !== subjectId) }));
    setDeleteConfirm(null);
  };

  const sections = selectedClass ? (classSections[selectedClass.id] || []) : [];
  const subjects = selectedClass ? (classSubjects[selectedClass.id] || []) : [];

  return (
    <div>
      <div className="page-header">
        <h1>Classes & Subjects</h1>
        <div className="actions">
          <button className="btn btn-primary btn-sm" style={{ width: 'auto' }} onClick={openAddClass}><FiPlus /> Add Class</button>
        </div>
      </div>

      {loading ? (
        <div className="card"><div className="spinner-container"><div className="spinner" /></div></div>
      ) : (
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          {/* Left panel — class list */}
          <div className="card" style={{ width: 220, flexShrink: 0, padding: 0 }}>
            {classes.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--gray-400)', fontSize: '0.82rem' }}>
                No classes yet.<br />Click "Add Class" to begin.
              </div>
            ) : (
              <div>
                {classes.map(c => (
                  <div
                    key={c.id}
                    onClick={() => selectClass(c)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--gray-100)',
                      background: selectedClass?.id === c.id ? 'var(--primary-50)' : 'transparent',
                      borderLeft: selectedClass?.id === c.id ? '3px solid var(--primary-500)' : '3px solid transparent',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: selectedClass?.id === c.id ? 'var(--primary-700)' : 'var(--gray-800)' }}>{c.name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--gray-400)' }}>Grade {c.grade_level}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 2 }} onClick={e => e.stopPropagation()}>
                      <button className="btn-icon" style={{ padding: 3 }} onClick={e => openEditClass(e, c)}><FiEdit2 size={12} /></button>
                      <button className="btn-icon" style={{ padding: 3, color: 'var(--danger-500)' }} onClick={e => { e.stopPropagation(); setDeleteConfirm({ id: c.id, type: 'class' }); }}><FiTrash2 size={12} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right panel — sections + subjects */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {!selectedClass ? (
              <div className="card"><div className="empty-state"><h3>Select a class</h3><p>Choose a class from the left to manage its sections and subjects</p></div></div>
            ) : detailLoading ? (
              <div className="card"><div className="spinner-container"><div className="spinner" /></div></div>
            ) : (
              <>
                {/* Sections */}
                <div className="card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--gray-100)' }}>
                    <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Sections — {selectedClass.name}</h3>
                    <button className="btn btn-secondary btn-sm" style={{ padding: '4px 12px' }} onClick={() => { setSecForm({ name: '' }); setShowSecModal(true); }}>
                      <FiPlus size={12} /> Add Section
                    </button>
                  </div>
                  <div style={{ padding: '12px 16px' }}>
                    {sections.length === 0 ? (
                      <p style={{ color: 'var(--gray-400)', fontSize: '0.85rem', margin: 0 }}>No sections yet. Add one above.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {sections.map((sec: any) => {
                          const ct = teacherById(sec.class_teacher_id);
                          return (
                            <div key={sec.id} style={{
                              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                              background: '#fff', border: '1px solid var(--gray-200)',
                              borderRadius: 'var(--radius-md)', flexWrap: 'wrap',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                            }}>
                              {/* Section badge */}
                              <div style={{
                                width: 44, height: 44, borderRadius: 'var(--radius-md)',
                                background: 'var(--primary-50)', color: 'var(--primary-700)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: 800, fontSize: '1.1rem', flexShrink: 0,
                              }}>
                                {sec.name}
                              </div>

                              <div style={{ flex: 1, minWidth: 200 }}>
                                <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--gray-800)' }}>
                                  Section {sec.name}
                                </div>
                                {/* Class teacher chip OR assign button */}
                                {ct ? (
                                  <div
                                    onClick={() => { setTeacherModalSection(sec); setTeacherSearch(''); }}
                                    style={{
                                      display: 'inline-flex', alignItems: 'center', gap: 8,
                                      marginTop: 6, padding: '4px 8px 4px 4px',
                                      background: 'var(--success-50)', border: '1px solid var(--success-200)',
                                      borderRadius: 'var(--radius-full)', cursor: 'pointer',
                                      transition: 'all .15s',
                                    }}
                                    onMouseOver={e => (e.currentTarget.style.background = 'var(--success-100, #d1fae5)')}
                                    onMouseOut={e => (e.currentTarget.style.background = 'var(--success-50)')}
                                  >
                                    <div className="avatar" style={{ width: 24, height: 24, fontSize: '0.62rem', background: 'var(--success-500)' }}>
                                      {getInitials(`${ct.first_name || ''} ${ct.last_name || ''}`)}
                                    </div>
                                    <div style={{ fontSize: '0.78rem' }}>
                                      <span style={{ fontWeight: 700, color: 'var(--success-700)' }}>{ct.first_name} {ct.last_name}</span>
                                      <span style={{ color: 'var(--gray-500)', marginLeft: 4 }}>· Class Teacher</span>
                                    </div>
                                    <FiEdit2 size={11} style={{ color: 'var(--gray-400)', marginLeft: 2 }} />
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => { setTeacherModalSection(sec); setTeacherSearch(''); }}
                                    style={{
                                      display: 'inline-flex', alignItems: 'center', gap: 6,
                                      marginTop: 6, padding: '4px 10px',
                                      background: 'transparent', border: '1px dashed var(--gray-300)',
                                      borderRadius: 'var(--radius-full)', cursor: 'pointer',
                                      fontSize: '0.78rem', color: 'var(--gray-500)', fontWeight: 600,
                                    }}
                                  >
                                    <FiUser size={12} /> + Assign class teacher
                                  </button>
                                )}
                              </div>

                              <button className="btn-icon" title="Delete section"
                                style={{ color: 'var(--danger-500)' }}
                                onClick={() => setDeleteConfirm({ id: sec.id, type: 'section', classId: selectedClass.id })}>
                                <FiTrash2 size={14} />
                              </button>

                              {/* Per-section subject teachers — Class 11-A Hindi → Mrs Sharma, etc. */}
                              <SectionRosterPanel
                                sectionId={sec.id}
                                sectionName={sec.name}
                                className={selectedClass.name}
                                teachers={teachers}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Subjects */}
                <div className="card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--gray-100)' }}>
                    <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Subjects — {selectedClass.name}</h3>
                    <button className="btn btn-secondary btn-sm" style={{ padding: '4px 12px' }} onClick={() => { setSubjForm({ name: '', code: '' }); setShowSubjModal(true); }}>
                      <FiPlus size={12} /> Add Subject
                    </button>
                  </div>
                  <div style={{ padding: '12px 16px' }}>
                    {subjects.length === 0 ? (
                      <p style={{ color: 'var(--gray-400)', fontSize: '0.85rem', margin: 0 }}>No subjects yet. Add one above.</p>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {subjects.map((subj: any) => (
                          <div key={subj.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', background: 'var(--success-50)', border: '1.5px solid var(--success-200)', borderRadius: 'var(--radius-full)' }}>
                            <FiBook size={11} style={{ color: 'var(--success-600)' }} />
                            <span style={{ fontWeight: 600, color: 'var(--success-700)', fontSize: '0.85rem' }}>{subj.name}</span>
                            {subj.code && <span style={{ fontSize: '0.72rem', color: 'var(--success-500)' }}>({subj.code})</span>}
                            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger-400)', padding: 0, display: 'flex', lineHeight: 1 }}
                              onClick={() => setDeleteConfirm({ id: subj.id, type: 'subject', classId: selectedClass.id })}>
                              <FiX size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Class modal */}
      {showClassModal && (
        <div className="modal-overlay" onClick={() => setShowClassModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header"><h3>{editClass ? 'Edit Class' : 'Add Class'}</h3><button className="btn-icon" onClick={() => setShowClassModal(false)}><FiX /></button></div>
            <form onSubmit={saveClass}>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label>Class Name *</label>
                    <input className="form-input" required placeholder="Nursery / LKG / Class 1" value={classForm.name} onChange={e => setClassForm(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Grade Level <span style={{ fontWeight: 400, color: 'var(--gray-400)' }}>(optional)</span></label>
                    <input className="form-input" type="number" min="0" max="12" placeholder="e.g. 0 for pre-primary, 1–12" value={classForm.grade_level} onChange={e => setClassForm(p => ({ ...p, grade_level: e.target.value }))} />
                    <p style={{ fontSize: '0.72rem', color: 'var(--gray-400)', marginTop: 3 }}>Use 0 for Nursery/LKG/UKG</p>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowClassModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ width: 'auto' }}>{saving ? 'Saving...' : (editClass ? 'Save' : 'Add Class')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Section modal */}
      {showSecModal && (
        <div className="modal-overlay" onClick={() => setShowSecModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <div className="modal-header"><h3>Add Section to {selectedClass?.name}</h3><button className="btn-icon" onClick={() => setShowSecModal(false)}><FiX /></button></div>
            <form onSubmit={saveSection}>
              <div className="modal-body">
                <div className="form-group"><label>Section Name *</label><input className="form-input" required placeholder="A" maxLength={5} value={secForm.name} onChange={e => setSecForm({ name: e.target.value.toUpperCase() })} /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowSecModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ width: 'auto' }}>{saving ? 'Adding...' : 'Add Section'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Subject modal */}
      {showSubjModal && (
        <div className="modal-overlay" onClick={() => setShowSubjModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header"><h3>Add Subject to {selectedClass?.name}</h3><button className="btn-icon" onClick={() => setShowSubjModal(false)}><FiX /></button></div>
            <form onSubmit={saveSubject}>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group"><label>Subject Name *</label><input className="form-input" required placeholder="Mathematics" value={subjForm.name} onChange={e => setSubjForm(p => ({ ...p, name: e.target.value }))} /></div>
                  <div className="form-group"><label>Code (optional)</label><input className="form-input" placeholder="MATH" value={subjForm.code} onChange={e => setSubjForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} /></div>
                </div>
                {/* Section context — clarify that the subject auto-applies to every section of the class */}
                <div style={{
                  marginTop: 12, padding: '10px 12px',
                  background: 'var(--primary-50, #eef2ff)',
                  border: '1px solid var(--primary-100, #c7d2fe)',
                  borderRadius: 'var(--radius-md, 8px)',
                  fontSize: '0.82rem', color: 'var(--gray-700, #374151)',
                }}>
                  <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--primary-700, #4338ca)' }}>
                    Applies to all sections of {selectedClass?.name}
                  </div>
                  {sections.length === 0 ? (
                    <span style={{ color: 'var(--gray-500, #6b7280)' }}>
                      This class has no sections yet. Add sections first, then this subject will appear in every section automatically.
                    </span>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                      {sections.map((sec: any) => (
                        <span key={sec.id} style={{
                          padding: '2px 10px',
                          background: '#fff',
                          border: '1px solid var(--primary-200, #c7d2fe)',
                          borderRadius: 'var(--radius-full, 999px)',
                          fontSize: '0.76rem', fontWeight: 600,
                          color: 'var(--primary-700, #4338ca)',
                        }}>
                          Section {sec.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowSubjModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ width: 'auto' }}>{saving ? 'Adding...' : 'Add Subject'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Class teacher picker modal */}
      {teacherModalSection && (
        <div className="modal-overlay" onClick={() => setTeacherModalSection(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h3>Class Teacher — Section {teacherModalSection.name}</h3>
              <button className="btn-icon" onClick={() => setTeacherModalSection(null)}><FiX /></button>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--gray-600)', marginBottom: 12 }}>
                Pick a teacher who will be responsible for <strong>{selectedClass?.name} - Section {teacherModalSection.name}</strong>. Parents in this section will be able to message them directly.
              </p>
              <input
                type="text" placeholder="Search teacher by name or department..."
                value={teacherSearch} onChange={e => setTeacherSearch(e.target.value)}
                style={{ width: '100%', marginBottom: 12 }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {/* None option */}
                <div
                  onClick={async () => { await setSectionTeacher(teacherModalSection.id, ''); setTeacherModalSection(null); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                    border: !teacherModalSection.class_teacher_id ? '2px solid var(--primary-500)' : '1px solid var(--gray-200)',
                    borderRadius: 'var(--radius-md)', cursor: 'pointer',
                    background: !teacherModalSection.class_teacher_id ? 'var(--primary-50)' : '#fff',
                  }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', background: 'var(--gray-100)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray-400)',
                  }}>
                    <FiX />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>No class teacher</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--gray-500)' }}>Section won't have an assigned teacher</div>
                  </div>
                </div>

                {teachers
                  .filter((t: any) => {
                    if (!teacherSearch.trim()) return true;
                    const q = teacherSearch.toLowerCase();
                    return `${t.first_name || ''} ${t.last_name || ''} ${t.department || ''} ${t.employee_id || ''}`.toLowerCase().includes(q);
                  })
                  .map((t: any, i: number) => {
                    const isSelected = teacherModalSection.class_teacher_id === t.id;
                    const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9'];
                    return (
                      <div
                        key={t.id}
                        onClick={async () => { await setSectionTeacher(teacherModalSection.id, t.id); setTeacherModalSection(null); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                          border: isSelected ? '2px solid var(--primary-500)' : '1px solid var(--gray-200)',
                          borderRadius: 'var(--radius-md)', cursor: 'pointer',
                          background: isSelected ? 'var(--primary-50)' : '#fff',
                          transition: 'all .12s',
                        }}
                      >
                        <div className="avatar" style={{ background: colors[i % colors.length], width: 36, height: 36, fontSize: '0.74rem', flexShrink: 0 }}>
                          {getInitials(`${t.first_name || ''} ${t.last_name || ''}`)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{t.first_name} {t.last_name}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--gray-500)' }}>
                            {t.employee_id} · {t.department || 'Teacher'}{t.qualification ? ` · ${t.qualification}` : ''}
                          </div>
                        </div>
                        {isSelected && <FiUserCheck size={18} style={{ color: 'var(--primary-600)' }} />}
                      </div>
                    );
                  })}
                {teachers.length === 0 && (
                  <p style={{ textAlign: 'center', color: 'var(--gray-400)', fontSize: '0.85rem', padding: 20 }}>
                    No teachers available. Add teachers first from the Teachers tab.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <div className="modal-header"><h3>Confirm Delete</h3><button className="btn-icon" onClick={() => setDeleteConfirm(null)}><FiX /></button></div>
            <div className="modal-body">
              <p>
                {deleteConfirm.type === 'class' && 'Delete this class and all its sections and subjects? This cannot be undone.'}
                {deleteConfirm.type === 'section' && 'Delete this section? Students in this section will be unassigned.'}
                {deleteConfirm.type === 'subject' && 'Delete this subject from the class? This cannot be undone.'}
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => {
                if (deleteConfirm.type === 'class') deleteClass(deleteConfirm.id);
                else if (deleteConfirm.type === 'section') deleteSection(deleteConfirm.id);
                else if (deleteConfirm.type === 'subject') deleteSubject(deleteConfirm.id);
              }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
