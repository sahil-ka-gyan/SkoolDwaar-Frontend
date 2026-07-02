import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FiBarChart2, FiSearch, FiSave, FiCheck, FiX, FiAward, FiAlertCircle,
  FiCheckCircle, FiUserX, FiBookOpen, FiChevronRight, FiCalendar,
} from 'react-icons/fi';
import client from '../../api/client';
import { getInitials } from '../../utils/helpers';

interface Exam {
  id: string;
  name: string;
  exam_type: string;
  start_date: string;
  end_date: string | null;
  class_name?: string;
  status: 'UPCOMING' | 'ONGOING' | 'COMPLETED';
  is_published: boolean;
  subject_count: number;
}

interface Paper {
  id: string;
  subject_name: string;
  subject_code?: string | null;
  max_marks: number;
  passing_marks: number;
  date: string;
  is_finalized: boolean;
}

interface StudentRow {
  student_id: string;
  name: string;
  admission_no: string;
  roll_no: string | null;
  marks_obtained: number | null;
  is_absent: boolean;
  grade: string | null;
  remarks: string | null;
  entered: boolean;
}

function gradeFor(pct: number): string {
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B+';
  if (pct >= 60) return 'B';
  if (pct >= 50) return 'C';
  if (pct >= 33) return 'D';
  return 'F';
}

const GRADE_COLOR: Record<string, string> = {
  'A+': '#059669', A: '#10b981', 'B+': '#3b82f6', B: '#0ea5e9',
  C: '#f59e0b', D: '#f97316', F: '#dc2626', AB: '#6b7280',
};

const AVATAR_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9', '#ec4899'];

export default function TeacherResults() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [examsLoading, setExamsLoading] = useState(true);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);
  const [marksheet, setMarksheet] = useState<{ paper: any; students: StudentRow[] } | null>(null);
  const [marksheetLoading, setMarksheetLoading] = useState(false);

  // Local editing state — { student_id: { marks, absent, remarks, dirty } }
  const [edits, setEdits] = useState<Record<string, { marks: string; absent: boolean; remarks: string; dirty: boolean }>>({});
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const showToast = useCallback((kind: 'ok' | 'err', msg: string) => {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 2800);
  }, []);

  // ── Load exams ─────────────────────────────────────────────────────────────
  useEffect(() => {
    client.get('/exams').then(r => {
      const list = (Array.isArray(r.data) ? r.data : []) as Exam[];
      // Teachers see only their own subjects' exams — backend already filters
      setExams(list);
    }).catch(() => {}).finally(() => setExamsLoading(false));
  }, []);

  // ── When exam selected → load its papers ───────────────────────────────────
  const loadExamPapers = useCallback(async (exam: Exam) => {
    setSelectedExam(exam);
    setSelectedPaper(null);
    setMarksheet(null);
    setEdits({});
    const r = await client.get(`/exams/${exam.id}/subjects`).catch(() => ({ data: [] }));
    setPapers(r.data || []);
  }, []);

  // ── When paper selected → load marksheet ───────────────────────────────────
  const loadMarksheet = useCallback(async (paper: Paper) => {
    setSelectedPaper(paper);
    setMarksheetLoading(true);
    try {
      const r = await client.get(`/exams/subjects/${paper.id}/marksheet`);
      setMarksheet(r.data);
      const seeded: typeof edits = {};
      (r.data.students || []).forEach((s: StudentRow) => {
        seeded[s.student_id] = {
          marks: s.marks_obtained != null ? String(s.marks_obtained) : '',
          absent: !!s.is_absent,
          remarks: s.remarks || '',
          dirty: false,
        };
      });
      setEdits(seeded);
    } finally {
      setMarksheetLoading(false);
    }
  }, []);

  // ── Mutation handlers ──────────────────────────────────────────────────────
  const setMarks = (sid: string, v: string) => {
    setEdits(prev => ({ ...prev, [sid]: { ...prev[sid], marks: v, absent: false, dirty: true } }));
  };
  const toggleAbsent = (sid: string) => {
    setEdits(prev => ({ ...prev, [sid]: { ...prev[sid], absent: !prev[sid]?.absent, marks: !prev[sid]?.absent ? '' : prev[sid]?.marks, dirty: true } }));
  };
  const setRemarks = (sid: string, v: string) => {
    setEdits(prev => ({ ...prev, [sid]: { ...prev[sid], remarks: v, dirty: true } }));
  };

  const dirtyCount = useMemo(() => Object.values(edits).filter(e => e.dirty).length, [edits]);

  const submitAll = async () => {
    if (!selectedPaper) return;
    const entries: any[] = [];
    Object.entries(edits).forEach(([student_id, e]) => {
      if (!e.dirty) return;
      let marks: number | null = null;
      if (!e.absent && e.marks !== '') {
        const n = Number(e.marks);
        if (!isNaN(n)) marks = n;
        else { showToast('err', `Invalid marks for ${marksheet?.students.find(s => s.student_id === student_id)?.name}`); return; }
        if (selectedPaper.max_marks && marks > selectedPaper.max_marks) {
          showToast('err', `${marks} > max marks (${selectedPaper.max_marks})`);
          return;
        }
        if (marks < 0) {
          showToast('err', `Marks must be ≥ 0`);
          return;
        }
      }
      entries.push({
        exam_subject_id: selectedPaper.id,
        student_id,
        marks_obtained: e.absent ? null : marks,
        is_absent: e.absent,
        remarks: e.remarks || null,
      });
    });
    if (entries.length === 0) {
      showToast('err', 'No changes to save');
      return;
    }
    setSaving(true);
    try {
      const r = await client.post('/results/enter', entries);
      showToast('ok', r.data?.detail || `Saved ${entries.length}`);
      // Mark all as clean + reload marksheet to pick up server-computed grades
      await loadMarksheet(selectedPaper);
    } catch (e: any) {
      showToast('err', e?.response?.data?.detail || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const finalizeNow = async () => {
    if (!selectedPaper) return;
    if (!confirm(`Mark "${selectedPaper.subject_name}" as finalized? You can still ask admin to reopen if needed.`)) return;
    setFinalizing(true);
    try {
      await client.post(`/exams/subjects/${selectedPaper.id}/finalize`);
      showToast('ok', 'Paper finalized');
      // Refresh papers
      if (selectedExam) await loadExamPapers(selectedExam);
    } catch (e: any) {
      showToast('err', e?.response?.data?.detail || 'Failed to finalize');
    } finally {
      setFinalizing(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  // Filter list
  const filteredStudents = useMemo(() => {
    if (!marksheet) return [];
    const q = search.trim().toLowerCase();
    if (!q) return marksheet.students;
    return marksheet.students.filter(s =>
      `${s.name} ${s.admission_no} ${s.roll_no || ''}`.toLowerCase().includes(q));
  }, [marksheet, search]);

  // Live stats
  const stats = useMemo(() => {
    if (!marksheet || !selectedPaper) return null;
    let entered = 0, pass = 0, fail = 0, absent = 0, total = 0, marksSum = 0, marksCount = 0;
    Object.entries(edits).forEach(([sid, e]) => {
      total++;
      if (e.absent) { entered++; absent++; return; }
      if (e.marks === '') return;
      entered++;
      const n = Number(e.marks);
      if (isNaN(n)) return;
      if (n >= (selectedPaper.passing_marks || 0)) pass++; else fail++;
      marksSum += n;
      marksCount++;
    });
    const avg = marksCount ? Math.round((marksSum / marksCount) * 10) / 10 : 0;
    const avgPct = selectedPaper.max_marks ? Math.round((avg / selectedPaper.max_marks) * 100) : 0;
    return { entered, pass, fail, absent, total, avg, avgPct };
  }, [edits, marksheet, selectedPaper]);

  return (
    <div>
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 1100,
          padding: '12px 18px', borderRadius: 'var(--radius-md)',
          background: toast.kind === 'ok' ? 'var(--success-600, #059669)' : 'var(--danger-600, #dc2626)',
          color: '#fff', fontSize: '0.88rem', fontWeight: 600,
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)', maxWidth: 420,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {toast.kind === 'ok' ? <FiCheckCircle /> : <FiAlertCircle />} {toast.msg}
        </div>
      )}

      <div className="page-header">
        <div>
          <h1>📊 Results & Marks</h1>
          <p style={{ color: 'var(--gray-400)', fontSize: '0.85rem', margin: '4px 0 0' }}>
            Enter marks for your papers. Live grade preview. Finalize when ready — admin publishes the final result.
          </p>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="card" style={{ marginBottom: '0.75rem' }}>
        <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => { setSelectedExam(null); setSelectedPaper(null); setMarksheet(null); }}
            style={{
              background: !selectedExam ? 'var(--primary-50)' : 'transparent', border: 'none',
              color: !selectedExam ? 'var(--primary-700)' : 'var(--gray-600)',
              padding: '6px 12px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem',
            }}>Exams</button>
          {selectedExam && (
            <>
              <FiChevronRight size={14} style={{ color: 'var(--gray-300)' }} />
              <button onClick={() => { setSelectedPaper(null); setMarksheet(null); }}
                style={{
                  background: !selectedPaper ? 'var(--primary-50)' : 'transparent', border: 'none',
                  color: !selectedPaper ? 'var(--primary-700)' : 'var(--gray-600)',
                  padding: '6px 12px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem',
                }}>{selectedExam.name}</button>
            </>
          )}
          {selectedPaper && (
            <>
              <FiChevronRight size={14} style={{ color: 'var(--gray-300)' }} />
              <span style={{ padding: '6px 12px', background: 'var(--primary-50)', color: 'var(--primary-700)', borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: '0.88rem' }}>
                {selectedPaper.subject_name}
              </span>
            </>
          )}
        </div>
      </div>

      {/* ─── EXAM LIST ─── */}
      {!selectedExam && (
        examsLoading ? (
          <div className="card"><div className="spinner-container"><div className="spinner" /></div></div>
        ) : exams.length === 0 ? (
          <div className="card"><div className="empty-state">
            <FiBookOpen size={32} style={{ color: 'var(--gray-300)' }} />
            <h3>No exams yet</h3>
            <p>Once your admin creates exams with papers for subjects you teach, they'll appear here.</p>
          </div></div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {exams.map(e => (
              <button key={e.id} onClick={() => loadExamPapers(e)}
                className="card"
                style={{
                  textAlign: 'left', cursor: 'pointer', border: 'none',
                  padding: 16, transition: 'transform 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={ev => { ev.currentTarget.style.transform = 'translateY(-2px)'; ev.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)'; }}
                onMouseLeave={ev => { ev.currentTarget.style.transform = 'translateY(0)'; ev.currentTarget.style.boxShadow = ''; }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <span className="badge badge-neutral" style={{ fontSize: '0.65rem' }}>{e.exam_type.replace('_', ' ')}</span>
                  {e.is_published && <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>Published</span>}
                  {!e.is_published && <span className="badge badge-warning" style={{ fontSize: '0.65rem' }}>Draft</span>}
                </div>
                <h3 style={{ margin: '4px 0 6px', fontSize: '1rem' }}>{e.name}</h3>
                {e.class_name && <div style={{ fontSize: '0.78rem', color: 'var(--gray-500)' }}>{e.class_name}</div>}
                <div style={{ display: 'flex', gap: 10, marginTop: 10, fontSize: '0.78rem', color: 'var(--gray-500)' }}>
                  <span><FiCalendar size={11} style={{ display: 'inline', marginRight: 4 }} />{e.start_date}{e.end_date ? ` → ${e.end_date}` : ''}</span>
                  <span>{e.subject_count} paper{e.subject_count === 1 ? '' : 's'}</span>
                </div>
              </button>
            ))}
          </div>
        )
      )}

      {/* ─── PAPER PICKER ─── */}
      {selectedExam && !selectedPaper && (
        papers.length === 0 ? (
          <div className="card"><div className="empty-state">
            <FiBookOpen size={28} style={{ color: 'var(--gray-300)' }} />
            <h3>No papers yet</h3>
            <p>Ask your admin to add papers for subjects you teach.</p>
          </div></div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {papers.map(p => {
              const isPast = new Date(p.date + 'T00:00:00') <= new Date();
              return (
                <button key={p.id} onClick={() => loadMarksheet(p)} disabled={!isPast}
                  className="card"
                  title={!isPast ? `Marks can only be entered after ${p.date}` : ''}
                  style={{
                    textAlign: 'left', cursor: isPast ? 'pointer' : 'not-allowed', border: 'none',
                    padding: 16, opacity: isPast ? 1 : 0.5,
                    borderLeft: `4px solid ${p.is_finalized ? 'var(--success-500)' : 'var(--primary-500)'}`,
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>{p.subject_code || 'PAPER'}</span>
                    {p.is_finalized
                      ? <span className="badge badge-success" style={{ fontSize: '0.65rem' }}><FiCheck size={9} /> Finalized</span>
                      : <span className="badge badge-warning" style={{ fontSize: '0.65rem' }}>Open</span>}
                  </div>
                  <h3 style={{ margin: '4px 0 6px', fontSize: '1rem' }}>{p.subject_name}</h3>
                  <div style={{ fontSize: '0.78rem', color: 'var(--gray-500)' }}>
                    {p.date} · Max {p.max_marks} · Pass {p.passing_marks}
                  </div>
                  {!isPast && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--warning-600, #d97706)', marginTop: 6 }}>
                      Marks entry opens on {p.date}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )
      )}

      {/* ─── MARKSHEET ─── */}
      {selectedPaper && marksheet && (
        <>
          {/* Stats bar */}
          {stats && (
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', marginBottom: '0.75rem' }}>
              <div className="stat-card blue">
                <div className="stat-icon blue"><FiCheck /></div>
                <div className="stat-info"><span className="label">Entered</span><span className="value">{stats.entered}/{stats.total}</span></div>
              </div>
              <div className="stat-card green">
                <div className="stat-icon green"><FiCheckCircle /></div>
                <div className="stat-info"><span className="label">Pass</span><span className="value">{stats.pass}</span></div>
              </div>
              <div className="stat-card rose">
                <div className="stat-icon rose"><FiX /></div>
                <div className="stat-info"><span className="label">Fail</span><span className="value">{stats.fail}</span></div>
              </div>
              <div className="stat-card amber">
                <div className="stat-icon amber"><FiUserX /></div>
                <div className="stat-info"><span className="label">Absent</span><span className="value">{stats.absent}</span></div>
              </div>
              <div className="stat-card purple">
                <div className="stat-icon purple"><FiAward /></div>
                <div className="stat-info">
                  <span className="label">Avg</span>
                  <span className="value">{stats.avg}/{selectedPaper.max_marks} · {stats.avgPct}%</span>
                </div>
              </div>
            </div>
          )}

          {/* Toolbar */}
          <div className="card" style={{ marginBottom: '0.75rem' }}>
            <div className="card-body" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
              <div style={{ position: 'relative', width: 280 }}>
                <FiSearch style={{ position: 'absolute', left: '.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
                <input type="text" placeholder="Search by name, roll, admission…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: '2.2rem', width: '100%' }} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {!selectedPaper.is_finalized ? (
                  <>
                    <button className="btn btn-primary btn-sm" style={{ minWidth: 140 }} onClick={submitAll} disabled={saving || dirtyCount === 0}>
                      <FiSave size={13} /> {saving ? 'Saving…' : (dirtyCount > 0 ? `Save (${dirtyCount})` : 'Saved')}
                    </button>
                    <button className="btn btn-secondary btn-sm" style={{ minWidth: 110 }} onClick={finalizeNow} disabled={finalizing || stats?.entered === 0}
                      title="Mark this paper ready for the admin to publish">
                      <FiAward size={13} /> {finalizing ? 'Finalizing…' : 'Finalize'}
                    </button>
                  </>
                ) : (
                  <div style={{
                    padding: '6px 14px', borderRadius: 'var(--radius-full)', fontSize: '0.78rem', fontWeight: 700,
                    background: 'var(--success-50, #d1fae5)', color: 'var(--success-600, #059669)',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <FiCheckCircle /> Paper finalized · ask admin to reopen for edits
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Marksheet table */}
          <div className="card">
            <div className="card-body no-padding">
              {marksheetLoading ? (
                <div className="spinner-container"><div className="spinner" /></div>
              ) : filteredStudents.length === 0 ? (
                <div className="empty-state"><h3>No students found</h3></div>
              ) : (
                <div className="data-table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: 60 }}>Roll</th>
                        <th>Student</th>
                        <th style={{ width: 140 }}>Marks / {selectedPaper.max_marks}</th>
                        <th style={{ width: 90 }}>Absent</th>
                        <th style={{ width: 100 }}>Grade · %</th>
                        <th style={{ width: 100 }}>Status</th>
                        <th>Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map((s, i) => {
                        const e = edits[s.student_id] || { marks: '', absent: false, remarks: '', dirty: false };
                        const marksNum = e.marks === '' ? null : Number(e.marks);
                        const validNum = marksNum !== null && !isNaN(marksNum);
                        const pct = (validNum && selectedPaper.max_marks) ? (marksNum! / selectedPaper.max_marks) * 100 : null;
                        const grade = e.absent ? 'AB' : (pct !== null ? gradeFor(pct) : null);
                        const passed = validNum && marksNum! >= selectedPaper.passing_marks;
                        return (
                          <tr key={s.student_id} style={{ background: e.dirty ? 'var(--warning-50, #fffbeb)' : undefined }}>
                            <td style={{ fontWeight: 700, color: 'var(--gray-500)' }}>{s.roll_no || '—'}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div className="avatar" style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length], width: 30, height: 30, fontSize: '0.7rem' }}>
                                  {getInitials(s.name)}
                                </div>
                                <div>
                                  <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{s.name}</div>
                                  <div style={{ fontSize: '0.7rem', color: 'var(--gray-400)' }}>{s.admission_no}</div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <input
                                type="number" inputMode="decimal" min={0} max={selectedPaper.max_marks} step={0.5}
                                disabled={e.absent || selectedPaper.is_finalized}
                                value={e.marks}
                                onChange={ev => setMarks(s.student_id, ev.target.value)}
                                placeholder="—"
                                style={{
                                  width: '100%', padding: '6px 10px', fontSize: '0.9rem', fontWeight: 600,
                                  border: `1.5px solid ${e.dirty ? 'var(--primary-300, #a5b4fc)' : 'var(--gray-200)'}`,
                                  borderRadius: 'var(--radius-md)',
                                  color: validNum && !passed ? 'var(--danger-600, #dc2626)' : 'var(--gray-800)',
                                  textAlign: 'center',
                                  background: e.absent ? 'var(--gray-100)' : '#fff',
                                }}
                              />
                            </td>
                            <td>
                              <button onClick={() => toggleAbsent(s.student_id)} disabled={selectedPaper.is_finalized}
                                style={{
                                  padding: '4px 10px', borderRadius: 'var(--radius-full)', fontSize: '0.72rem', fontWeight: 700,
                                  border: `1.5px solid ${e.absent ? '#6b7280' : 'var(--gray-200)'}`,
                                  background: e.absent ? '#374151' : '#fff',
                                  color: e.absent ? '#fff' : 'var(--gray-500)',
                                  cursor: 'pointer',
                                }}>{e.absent ? 'AB ✓' : 'AB'}</button>
                            </td>
                            <td>
                              {grade ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{
                                    padding: '3px 8px', borderRadius: 'var(--radius-full)', fontSize: '0.74rem', fontWeight: 800,
                                    background: GRADE_COLOR[grade] + '20', color: GRADE_COLOR[grade],
                                  }}>{grade}</span>
                                  {pct !== null && <span style={{ fontSize: '0.76rem', color: 'var(--gray-500)' }}>{Math.round(pct)}%</span>}
                                </div>
                              ) : (
                                <span style={{ color: 'var(--gray-300)', fontSize: '0.82rem' }}>—</span>
                              )}
                            </td>
                            <td>
                              {e.absent ? (
                                <span className="badge" style={{ background: '#374151', color: '#fff', fontSize: '0.65rem' }}>ABSENT</span>
                              ) : validNum ? (
                                passed
                                  ? <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>PASS</span>
                                  : <span className="badge badge-danger" style={{ fontSize: '0.65rem' }}>FAIL</span>
                              ) : (
                                <span style={{ color: 'var(--gray-300)', fontSize: '0.78rem' }}>pending</span>
                              )}
                            </td>
                            <td>
                              <input type="text" value={e.remarks} onChange={ev => setRemarks(s.student_id, ev.target.value)}
                                disabled={selectedPaper.is_finalized}
                                placeholder="optional note"
                                style={{ width: '100%', padding: '4px 8px', fontSize: '0.82rem', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-sm)' }} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Sticky bottom save bar */}
          {dirtyCount > 0 && !selectedPaper.is_finalized && (
            <div style={{
              position: 'sticky', bottom: 0, marginTop: 16,
              padding: '12px 18px', background: '#fff',
              border: '1.5px solid var(--primary-200)',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 -4px 16px rgba(0,0,0,0.05)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            }}>
              <span style={{ fontSize: '0.88rem', color: 'var(--gray-700)' }}>
                <strong>{dirtyCount}</strong> unsaved change{dirtyCount === 1 ? '' : 's'}
              </span>
              <button className="btn btn-primary btn-sm" onClick={submitAll} disabled={saving}>
                <FiSave size={13} /> {saving ? 'Saving…' : 'Save all marks'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
