import { toast } from '../../utils/toast';
import React, { useState, useEffect, useMemo } from 'react';
import {
  FiPlus, FiEdit2, FiTrash2, FiX, FiCalendar, FiClock, FiBook, FiMapPin,
  FiChevronRight, FiChevronDown, FiFileText, FiSave, FiCheck, FiSend, FiAlertCircle,
  FiAward,
} from 'react-icons/fi';
import { useAuthStore } from '../../stores/authStore';
import client from '../../api/client';
import { formatDate } from '../../utils/helpers';
import ExamRankings from '../../components/ExamRankings';

const EXAM_TYPES = [
  { value: 'UNIT_TEST', label: 'Unit Test' },
  { value: 'MID_TERM', label: 'Mid Term' },
  { value: 'FINAL', label: 'Final Exam' },
  { value: 'PRACTICAL', label: 'Practical' },
  { value: 'OTHER', label: 'Other' },
];
const TYPE_LABEL: Record<string, string> = Object.fromEntries(EXAM_TYPES.map(t => [t.value, t.label]));
const TYPE_COLOR: Record<string, string> = {
  UNIT_TEST: '#0ea5e9', MID_TERM: '#f59e0b', FINAL: '#ef4444', PRACTICAL: '#8b5cf6', OTHER: '#6b7280',
};
const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  UPCOMING: { bg: '#dbeafe', color: '#2563eb' },
  ONGOING: { bg: '#fef3c7', color: '#d97706' },
  COMPLETED: { bg: '#dcfce7', color: '#16a34a' },
};

export default function Exams() {
  const { user } = useAuthStore();
  const isTeacher = user?.role === 'TEACHER';
  const isAdmin = user?.role === 'SCHOOL_ADMIN' || user?.role === 'SUPER_ADMIN';
  const [exams, setExams] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [sessions, setSessions] = useState<string[]>([]);
  const [mySubjectIds, setMySubjectIds] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [classFilter, setClassFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sessionFilter, setSessionFilter] = useState('');

  const [showExamModal, setShowExamModal] = useState(false);
  const [editExam, setEditExam] = useState<any>(null);
  const [examForm, setExamForm] = useState({ name: '', exam_type: 'UNIT_TEST', class_id: '', start_date: '', end_date: '', description: '' });

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);

  const [showPaperModal, setShowPaperModal] = useState(false);
  const [editPaper, setEditPaper] = useState<any>(null);
  const [paperForm, setPaperForm] = useState<any>({ subject_id: '', max_marks: 100, passing_marks: 33, date: '', start_time: '09:00', duration_minutes: 180, room: '', syllabus: '' });

  const [marksPaper, setMarksPaper] = useState<any>(null);
  const [marksheet, setMarksheet] = useState<any>(null);
  const [marksLoading, setMarksLoading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; type: 'exam' | 'paper' } | null>(null);
  const [rankingsExamId, setRankingsExamId] = useState<string | null>(null);

  useEffect(() => { fetchAll(); }, [classFilter, typeFilter, sessionFilter]);
  useEffect(() => {
    client.get('/classes').then(r => setClasses(r.data || [])).catch(() => {});
    client.get('/subjects').then(r => setSubjects(r.data || [])).catch(() => {});
    client.get('/exams/sessions').then(r => setSessions(r.data || [])).catch(() => {});
    if (isTeacher) {
      client.get('/staff/my/classes')
        .then(r => {
          const ids: string[] = [];
          (r.data?.classes || []).forEach((c: any) => (c.subjects || []).forEach((s: any) => ids.push(s.id)));
          setMySubjectIds(ids);
        })
        .catch(() => setMySubjectIds([]));
    }
  }, [isTeacher]);

  const fetchAll = async () => {
    setLoading(true);
    const params: any = {};
    if (classFilter) params.class_id = classFilter;
    if (typeFilter) params.exam_type = typeFilter;
    if (sessionFilter) params.session = sessionFilter;
    await client.get('/exams', { params }).then(r => setExams(r.data || [])).catch(() => {});
    setLoading(false);
  };

  const loadDetail = async (examId: string) => {
    if (expandedId === examId) { setExpandedId(null); setDetail(null); return; }
    setExpandedId(examId);
    const r = await client.get(`/exams/${examId}`).catch(() => ({ data: null }));
    setDetail(r.data);
  };

  const openAddExam = () => {
    setEditExam(null);
    setExamForm({ name: '', exam_type: 'UNIT_TEST', class_id: classes[0]?.id || '', start_date: '', end_date: '', description: '' });
    setShowExamModal(true);
  };
  const openEditExam = (e: any) => {
    setEditExam(e);
    setExamForm({ name: e.name, exam_type: e.exam_type, class_id: e.class_id || '', start_date: e.start_date, end_date: e.end_date || '', description: e.description || '' });
    setShowExamModal(true);
  };
  const saveExam = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setSaving(true);
    try {
      const payload: any = { ...examForm };
      if (!payload.class_id) payload.class_id = null;
      if (!payload.end_date) payload.end_date = null;
      if (!payload.description) payload.description = null;
      if (editExam) await client.patch(`/exams/${editExam.id}`, payload);
      else await client.post('/exams', payload);
      setShowExamModal(false);
      fetchAll();
    } catch (err: any) { toast.error(err?.response?.data?.detail || 'Error'); }
    setSaving(false);
  };
  const deleteExam = async (id: string) => {
    await client.delete(`/exams/${id}`).catch(() => {});
    setDeleteConfirm(null);
    if (expandedId === id) { setExpandedId(null); setDetail(null); }
    fetchAll();
  };

  const classSubjects = useMemo(() => {
    if (!detail?.class_id) return [];
    // Subjects that belong to the exam's class
    const inClass = subjects.filter((s: any) =>
      s.class_id === detail.class_id || (s.class_ids || []).includes(detail.class_id)
    );
    // Teachers see only subjects they're assigned to
    if (isTeacher && mySubjectIds) {
      return inClass.filter((s: any) => mySubjectIds.includes(s.id));
    }
    return inClass;
  }, [subjects, detail, isTeacher, mySubjectIds]);

  const openAddPaper = () => {
    setEditPaper(null);
    setPaperForm({ subject_id: '', max_marks: 100, passing_marks: 33, date: detail?.start_date || '', start_time: '09:00', duration_minutes: 180, room: '', syllabus: '' });
    setShowPaperModal(true);
  };
  const openEditPaper = (p: any) => {
    setEditPaper(p);
    setPaperForm({
      subject_id: p.subject_id, max_marks: p.max_marks, passing_marks: p.passing_marks,
      date: p.date, start_time: p.start_time || '09:00', duration_minutes: p.duration_minutes || 180,
      room: p.room || '', syllabus: p.syllabus || '',
    });
    setShowPaperModal(true);
  };
  const savePaper = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!paperForm.subject_id) { toast.error('Select a subject'); return; }
    setSaving(true);
    try {
      if (editPaper) {
        // Teachers can only patch syllabus; admins patch everything (or syllabus-only mode)
        const syllabusOnly = isTeacher || editPaper._syllabusOnly;
        const patch = syllabusOnly ? { syllabus: paperForm.syllabus } : paperForm;
        await client.patch(`/exams/subjects/${editPaper.id}`, patch);
      } else {
        await client.post('/exams/subjects', { exam_id: expandedId, ...paperForm });
      }
      setShowPaperModal(false);
      const r = await client.get(`/exams/${expandedId}`);
      setDetail(r.data);
      fetchAll();
    } catch (err: any) { toast.error(err?.response?.data?.detail || 'Error'); }
    setSaving(false);
  };
  const deletePaper = async (id: string) => {
    await client.delete(`/exams/subjects/${id}`).catch(() => {});
    setDeleteConfirm(null);
    const r = await client.get(`/exams/${expandedId}`);
    setDetail(r.data);
    fetchAll();
  };

  const refreshDetail = async () => {
    if (!expandedId) return;
    const r = await client.get(`/exams/${expandedId}`);
    setDetail(r.data);
    fetchAll();
  };

  const togglePaperFinalize = async (paper: any) => {
    try {
      if (paper.is_finalized) {
        await client.post(`/exams/subjects/${paper.id}/unfinalize`);
      } else {
        await client.post(`/exams/subjects/${paper.id}/finalize`);
      }
      await refreshDetail();
    } catch (err: any) { toast.error(err?.response?.data?.detail || 'Error'); }
  };

  const publishExam = async (exam: any) => {
    if (!confirm(`Publish & announce exam schedule for "${exam.name}"? Students and parents will see the timetable & syllabus.`)) return;
    try {
      await client.post(`/exams/${exam.id}/publish`);
      toast.success(`📢 Exam schedule announced. Students & parents notified.`);
      await refreshDetail();
    } catch (err: any) { toast.error(err?.response?.data?.detail || 'Error'); }
  };

  const unpublishExam = async (exam: any) => {
    if (!confirm('Move this exam back to draft? Students will no longer see it.')) return;
    try {
      await client.post(`/exams/${exam.id}/unpublish`);
      await refreshDetail();
    } catch (err: any) { toast.error(err?.response?.data?.detail || 'Error'); }
  };

  const announceResult = async (exam: any) => {
    if (!confirm(`Announce results for "${exam.name}"? Students and parents will see their marks, grades, and class ranking.`)) return;
    try {
      await client.post(`/exams/${exam.id}/announce-result`);
      toast.success(`📊 Results announced! Students & parents have been notified.`);
      await refreshDetail();
      // Auto-open the rankings view so admin sees the leaderboard immediately
      setRankingsExamId(exam.id);
    } catch (err: any) { toast.error(err?.response?.data?.detail || 'Error'); }
  };

  const withdrawResult = async (exam: any) => {
    if (!confirm('Withdraw result announcement? Students and parents will no longer see results.')) return;
    try {
      await client.post(`/exams/${exam.id}/withdraw-result`);
      toast.success('Result announcement withdrawn.');
      await refreshDetail();
    } catch (err: any) { toast.error(err?.response?.data?.detail || 'Error'); }
  };

  const openMarks = async (paper: any) => {
    setMarksPaper(paper);
    setMarksLoading(true);
    const r = await client.get(`/exams/subjects/${paper.id}/marksheet`).catch(() => ({ data: null }));
    setMarksheet(r.data);
    setMarksLoading(false);
  };
  const setMark = (studentId: string, field: string, value: any) => {
    setMarksheet((prev: any) => ({
      ...prev,
      students: prev.students.map((s: any) => s.student_id === studentId ? { ...s, [field]: value } : s),
    }));
  };
  const saveMarks = async () => {
    if (!marksheet) return;
    setSaving(true);
    try {
      const entries = marksheet.students.map((s: any) => ({
        exam_subject_id: marksPaper.id,
        student_id: s.student_id,
        marks_obtained: s.is_absent ? null : (s.marks_obtained === '' || s.marks_obtained == null ? null : Number(s.marks_obtained)),
        is_absent: !!s.is_absent,
        remarks: s.remarks || null,
      })).filter((e: any) => e.is_absent || e.marks_obtained != null);
      await client.post('/results/enter', entries);
      setMarksPaper(null); setMarksheet(null);
      toast.success('Marks saved successfully');
    } catch (err: any) { toast.error(err?.response?.data?.detail || 'Error'); }
    setSaving(false);
  };

  return (
    <div>
      <div className="page-header">
        <h1>📝 Examinations</h1>
        <div className="actions">
          {isAdmin && <button className="btn btn-primary btn-sm" style={{ width: 'auto' }} onClick={openAddExam}><FiPlus /> Create Exam</button>}
        </div>
      </div>

      <div className="filter-bar" style={{ marginBottom: 16, gap: 8, flexWrap: 'wrap' }}>
        <select value={classFilter} onChange={e => setClassFilter(e.target.value)} style={{ minWidth: 160 }}>
          <option value="">All Classes</option>
          {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ minWidth: 150 }}>
          <option value="">All Types</option>
          {EXAM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select value={sessionFilter} onChange={e => setSessionFilter(e.target.value)} style={{ minWidth: 150 }}>
          <option value="">All Sessions</option>
          {sessions.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {isTeacher && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: '0.76rem', color: '#2563eb',
            background: '#dbeafe', border: '1px solid #93c5fd',
            borderRadius: 'var(--radius-md)', padding: '4px 10px', fontWeight: 600,
          }}>
            🎓 Showing exams for your subjects only
          </span>
        )}
      </div>

      {loading ? (
        <div className="card"><div className="spinner-container"><div className="spinner" /></div></div>
      ) : exams.length === 0 ? (
        <div className="card"><div className="empty-state"><FiFileText size={32} style={{ color: 'var(--gray-300)' }} /><h3>No exams yet</h3><p>Create your first exam to get started</p></div></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {exams.map((e: any) => {
            const expanded = expandedId === e.id;
            const sb = STATUS_BADGE[e.status] || STATUS_BADGE.UPCOMING;
            return (
              <div key={e.id} className="card" style={{ overflow: 'visible' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer' }} onClick={() => loadDetail(e.id)}>
                  {expanded ? <FiChevronDown style={{ color: 'var(--gray-400)' }} /> : <FiChevronRight style={{ color: 'var(--gray-400)' }} />}
                  <div style={{ width: 4, alignSelf: 'stretch', borderRadius: 4, background: TYPE_COLOR[e.exam_type] || '#888' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{e.name}</span>
                      <span className="badge" style={{ background: (TYPE_COLOR[e.exam_type] || '#888') + '20', color: TYPE_COLOR[e.exam_type] || '#888', fontSize: '0.7rem' }}>{TYPE_LABEL[e.exam_type]}</span>
                      {e.class_name && <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>{e.class_name}</span>}
                      <span className="badge" style={{ background: sb.bg, color: sb.color, fontSize: '0.7rem' }}>{e.status}</span>
                      {e.is_published ? (
                        <span className="badge" style={{ background: '#dcfce7', color: '#15803d', fontSize: '0.7rem', fontWeight: 700 }}>📢 PUBLISHED</span>
                      ) : (
                        <span className="badge" style={{ background: '#fef3c7', color: '#a16207', fontSize: '0.7rem', fontWeight: 700 }}>📝 DRAFT</span>
                      )}
                      {e.is_result_announced && (
                        <span className="badge" style={{ background: '#dbeafe', color: '#1d4ed8', fontSize: '0.7rem', fontWeight: 700 }}>📊 RESULT ANNOUNCED</span>
                      )}
                      {isTeacher && e.my_pending_subject_names && e.my_pending_subject_names.length > 0 && (
                        <span className="badge" style={{ background: '#fee2e2', color: '#b91c1c', fontSize: '0.7rem', fontWeight: 700, border: '1px solid #fecaca' }}>
                          ⚠ Add syllabus: {e.my_pending_subject_names.join(', ')}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--gray-400)', marginTop: 3 }}>
                      <FiCalendar size={11} style={{ verticalAlign: -1 }} /> {formatDate(e.start_date)}{e.end_date && ` – ${formatDate(e.end_date)}`}
                      <span style={{ marginLeft: 10 }}>· {e.subject_count} paper{e.subject_count === 1 ? '' : 's'}</span>
                      {e.created_by_name && <span style={{ marginLeft: 10 }}>· by {e.created_by_name}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }} onClick={ev => ev.stopPropagation()}>
                    {isAdmin && !e.is_published && (
                      <>
                        <button className="btn-icon" onClick={() => openEditExam(e)}><FiEdit2 size={14} /></button>
                        <button className="btn-icon" style={{ color: 'var(--danger-500)' }} onClick={() => setDeleteConfirm({ id: e.id, type: 'exam' })}><FiTrash2 size={14} /></button>
                      </>
                    )}
                  </div>
                </div>

                {expanded && detail && detail.id === e.id && (
                  <div style={{ borderTop: '1px solid var(--gray-100)', padding: '12px 16px', background: 'var(--gray-50)' }}>
                    {/* Publish summary */}
                    {(() => {
                      const total = detail.papers.length;
                      const finalized = detail.papers.filter((p: any) => p.is_finalized).length;
                      const missing = detail.missing_papers || [];
                      const allPapersAdded = missing.length === 0 && total > 0;
                      const allDone = allPapersAdded && finalized === total;
                      return (
                        <>
                        {/* Publish / Exam schedule status */}
                        <div style={{
                          padding: '10px 12px', marginBottom: 12, borderRadius: 'var(--radius-md)',
                          background: detail.is_published ? '#dcfce7' : (allDone ? '#dbeafe' : '#fef3c7'),
                          border: '1px solid ' + (detail.is_published ? '#86efac' : allDone ? '#93c5fd' : '#fde68a'),
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                        }}>
                          <div style={{ fontSize: '0.82rem' }}>
                            {detail.is_published ? (
                              <>
                                <strong style={{ color: '#15803d' }}>📢 Exam Published</strong>
                                <span style={{ color: 'var(--gray-600)', marginLeft: 6 }}>
                                  {detail.published_at && `on ${formatDate(detail.published_at)}`}
                                  {detail.published_by_name && ` by ${detail.published_by_name}`}
                                </span>
                              </>
                            ) : allDone ? (
                              <><strong style={{ color: '#1d4ed8' }}>Ready to publish</strong><span style={{ color: 'var(--gray-600)', marginLeft: 6 }}>All {total} papers finalized — review then publish</span></>
                            ) : (
                              <><strong style={{ color: '#a16207' }}>Draft</strong>
                                <span style={{ color: 'var(--gray-600)', marginLeft: 6 }}>
                                  {missing.length > 0 && `${missing.length} subject(s) without papers · `}
                                  {finalized} of {total} added paper(s) finalized
                                </span>
                              </>
                            )}
                          </div>
                          {isAdmin && (
                            detail.is_published ? (
                              <button className="btn btn-secondary btn-sm" style={{ padding: '4px 12px' }} onClick={() => unpublishExam(detail)}>Unpublish</button>
                            ) : (
                              <button className="btn btn-primary btn-sm" style={{ padding: '4px 14px' }} disabled={!allDone} onClick={() => publishExam(detail)}>
                                <FiSend size={12} /> Publish & Announce
                              </button>
                            )
                          )}
                        </div>

                        {/* Result announcement status — only shown when exam is published */}
                        {detail.is_published && (
                          <div style={{
                            padding: '10px 12px', marginBottom: 12, borderRadius: 'var(--radius-md)',
                            background: detail.is_result_announced ? '#dbeafe' : '#f8fafc',
                            border: '1px solid ' + (detail.is_result_announced ? '#93c5fd' : 'var(--gray-200)'),
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                          }}>
                            <div style={{ fontSize: '0.82rem' }}>
                              {detail.is_result_announced ? (
                                <>
                                  <strong style={{ color: '#1d4ed8' }}>📊 Result Announced</strong>
                                  <span style={{ color: 'var(--gray-600)', marginLeft: 6 }}>
                                    {detail.result_announced_at && `on ${formatDate(detail.result_announced_at)}`}
                                    {detail.result_announced_by_name && ` by ${detail.result_announced_by_name}`}
                                  </span>
                                  <span style={{ color: 'var(--gray-400)', marginLeft: 6, fontSize: '0.76rem' }}>
                                    — Students & parents can view marks, grades, and rankings
                                  </span>
                                </>
                              ) : (
                                <>
                                  <strong style={{ color: 'var(--gray-500)' }}>📊 Result Not Announced</strong>
                                  <span style={{ color: 'var(--gray-400)', marginLeft: 6, fontSize: '0.76rem' }}>
                                    — Enter marks first, then click "Announce Result" to make them visible
                                  </span>
                                </>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: 6 }}>
                              {isAdmin && detail.is_result_announced && (
                                <>
                                  <button className="btn btn-primary btn-sm" style={{ padding: '4px 12px', background: '#6366f1' }} onClick={() => setRankingsExamId(detail.id)}>
                                    <FiAward size={12} /> View Rankings
                                  </button>
                                  <button className="btn btn-secondary btn-sm" style={{ padding: '4px 12px' }} onClick={() => withdrawResult(detail)}>Withdraw Result</button>
                                </>
                              )}
                              {isAdmin && !detail.is_result_announced && (
                                <button className="btn btn-primary btn-sm" style={{ padding: '4px 14px', background: '#2563eb' }} onClick={() => announceResult(detail)}>
                                  <FiAward size={12} /> Announce Result
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                        </>
                      );
                    })()}

                    {/* Missing papers checklist (admin view, draft state) */}
                    {isAdmin && !detail.is_published && (detail.missing_papers || []).length > 0 && (
                      <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: 12 }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#9a3412', marginBottom: 6 }}>
                          ⚠ Class subjects without a paper yet ({detail.missing_papers.length})
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {detail.missing_papers.map((m: any) => (
                            <div key={m.subject_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '4px 0' }}>
                              <span><FiBook size={11} style={{ verticalAlign: -1, color: '#c2410c', marginRight: 4 }} /><strong>{m.subject_name}</strong></span>
                              <span style={{ color: 'var(--gray-600)' }}>
                                {m.responsible_teachers.length === 0
                                  ? <em style={{ color: 'var(--danger-600)' }}>No teacher assigned</em>
                                  : <>👩‍🏫 {m.responsible_teachers.join(', ')}</>}
                              </span>
                            </div>
                          ))}
                        </div>
                        <p style={{ fontSize: '0.72rem', color: 'var(--gray-500)', marginTop: 6, marginBottom: 0 }}>
                          Click "Add Paper" above for each subject. After adding, the assigned teacher will fill the syllabus.
                        </p>
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <h4 style={{ margin: 0, fontSize: '0.88rem' }}>📅 Exam Timetable & Papers</h4>
                      {!detail.is_published && isAdmin && (
                        <button className="btn btn-secondary btn-sm" style={{ padding: '4px 12px' }} onClick={openAddPaper}><FiPlus size={12} /> Add Paper</button>
                      )}
                    </div>
                    {detail.papers.length === 0 ? (
                      <p style={{ color: 'var(--gray-400)', fontSize: '0.82rem', margin: 0 }}>No papers added. Click "Add Paper" to build the timetable.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {detail.papers.map((p: any) => {
                          const today = new Date(); today.setHours(0, 0, 0, 0);
                          const paperDate = new Date(p.date);
                          const conducted = paperDate.getTime() <= today.getTime();
                          return (
                          <div key={p.id} style={{
                            background: '#fff',
                            border: '1px solid ' + (p.is_finalized ? '#86efac' : 'var(--gray-200)'),
                            borderLeft: '4px solid ' + (p.is_finalized ? '#16a34a' : 'var(--gray-300)'),
                            borderRadius: 'var(--radius-md)', padding: '10px 14px',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                              <div style={{ flex: 1, minWidth: 160 }}>
                                <div style={{ fontWeight: 700, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                  <FiBook size={12} style={{ color: 'var(--primary-500)' }} /> {p.subject_name}
                                  {p.subject_code && <span style={{ fontSize: '0.7rem', color: 'var(--gray-400)' }}>({p.subject_code})</span>}
                                  {p.is_finalized ? (
                                    <span className="badge" style={{ background: '#dcfce7', color: '#15803d', fontSize: '0.66rem', fontWeight: 700 }}>✓ Finalized</span>
                                  ) : (
                                    <span className="badge" style={{ background: '#fef3c7', color: '#a16207', fontSize: '0.66rem', fontWeight: 700 }}>Draft</span>
                                  )}
                                </div>
                                <div style={{ fontSize: '0.74rem', color: 'var(--gray-500)', marginTop: 3, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                  <span><FiCalendar size={10} /> {formatDate(p.date)}</span>
                                  {p.start_time && <span><FiClock size={10} /> {p.start_time}</span>}
                                  {p.duration_minutes && <span>{p.duration_minutes} min</span>}
                                  {p.room && <span><FiMapPin size={10} /> {p.room}</span>}
                                  <span>Max {p.max_marks} · Pass {p.passing_marks}</span>
                                </div>
                                {p.syllabus && <div style={{ fontSize: '0.74rem', color: 'var(--gray-500)', marginTop: 4, fontStyle: 'italic' }}>📖 {p.syllabus}</div>}
                                {p.is_finalized && p.finalized_by_name && (
                                  <div style={{ fontSize: '0.68rem', color: '#15803d', marginTop: 3 }}>Finalized by {p.finalized_by_name}</div>
                                )}
                                {/* Admin callout: syllabus added but not yet finalized */}
                                {isAdmin && !p.is_finalized && p.syllabus && p.syllabus.trim() && (
                                  <div style={{
                                    marginTop: 6, padding: '6px 10px',
                                    background: '#dcfce7', border: '1px solid #86efac',
                                    borderRadius: 'var(--radius-md)',
                                    fontSize: '0.74rem', color: '#15803d',
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6,
                                  }}>
                                    <span>
                                      ✅ <strong>Syllabus added{p.syllabus_updated_by_name ? ` by ${p.syllabus_updated_by_name}` : ''}</strong>
                                      {p.syllabus_updated_at && (
                                        <span style={{ color: 'var(--gray-500)', marginLeft: 4 }}>· {formatDate(p.syllabus_updated_at)}</span>
                                      )}
                                      <span style={{ marginLeft: 6 }}>— review & click <strong>Mark Ready</strong> →</span>
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                {!detail.is_published && isAdmin && (
                                  <button
                                    className={p.is_finalized ? 'btn btn-secondary btn-sm' : 'btn btn-primary btn-sm'}
                                    style={{ padding: '4px 10px', fontSize: '0.74rem' }}
                                    onClick={() => togglePaperFinalize(p)}
                                  >
                                    {p.is_finalized ? 'Reopen' : <><FiCheck size={12} /> Mark Ready</>}
                                  </button>
                                )}
                                {conducted ? (
                                  <button className="btn btn-primary btn-sm" style={{ padding: '4px 10px', fontSize: '0.74rem' }} onClick={() => openMarks(p)}>Enter Marks</button>
                                ) : (
                                  <span title={`Marks entry unlocks after the paper date (${formatDate(p.date)})`} style={{ fontSize: '0.72rem', color: 'var(--gray-400)', padding: '4px 10px', border: '1px dashed var(--gray-300)', borderRadius: 'var(--radius-md)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    <FiClock size={11} /> Marks open after exam day
                                  </span>
                                )}
                                {!detail.is_published && !p.is_finalized && isAdmin && (
                                  <>
                                    <button className="btn btn-secondary btn-sm" style={{ padding: '4px 10px', fontSize: '0.74rem' }} onClick={() => { setEditPaper({ ...p, _syllabusOnly: true }); setPaperForm({ subject_id: p.subject_id, max_marks: p.max_marks, passing_marks: p.passing_marks, date: p.date, start_time: p.start_time || '09:00', duration_minutes: p.duration_minutes || 180, room: p.room || '', syllabus: p.syllabus || '' }); setShowPaperModal(true); }}>
                                      <FiEdit2 size={12} /> {p.syllabus ? 'Edit Syllabus' : '+ Add Syllabus'}
                                    </button>
                                    <button className="btn-icon" title="Edit full paper" onClick={() => openEditPaper(p)}><FiEdit2 size={13} /></button>
                                    <button className="btn-icon" style={{ color: 'var(--danger-500)' }} onClick={() => setDeleteConfirm({ id: p.id, type: 'paper' })}><FiTrash2 size={13} /></button>
                                  </>
                                )}
                                {!detail.is_published && !p.is_finalized && isTeacher && mySubjectIds && mySubjectIds.includes(p.subject_id) && (
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    style={{ padding: '4px 10px', fontSize: '0.74rem' }}
                                    onClick={() => openEditPaper(p)}
                                  >
                                    <FiEdit2 size={12} /> {p.syllabus ? 'Edit Syllabus' : '+ Add Syllabus'}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Exam modal */}
      {showExamModal && (
        <div className="modal-overlay" onClick={() => setShowExamModal(false)}>
          <div className="modal" onClick={ev => ev.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header"><h3>{editExam ? 'Edit Exam' : 'Create Exam'}</h3><button className="btn-icon" onClick={() => setShowExamModal(false)}><FiX /></button></div>
            <form onSubmit={saveExam}>
              <div className="modal-body">
                <div className="form-group"><label>Exam Name *</label><input className="form-input" required placeholder="e.g. Mid Term Examination" value={examForm.name} onChange={e => setExamForm(p => ({ ...p, name: e.target.value }))} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label>Type *</label>
                    <select className="form-input" value={examForm.exam_type} onChange={e => setExamForm(p => ({ ...p, exam_type: e.target.value }))}>
                      {EXAM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Class *</label>
                    <select className="form-input" required value={examForm.class_id} onChange={e => setExamForm(p => ({ ...p, class_id: e.target.value }))}>
                      <option value="">Select class…</option>
                      {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label>Start Date *</label><input className="form-input" type="date" required value={examForm.start_date} onChange={e => setExamForm(p => ({ ...p, start_date: e.target.value }))} /></div>
                  <div className="form-group"><label>End Date</label><input className="form-input" type="date" value={examForm.end_date} onChange={e => setExamForm(p => ({ ...p, end_date: e.target.value }))} /></div>
                </div>
                <div className="form-group"><label>Description</label><textarea className="form-input" rows={2} value={examForm.description} onChange={e => setExamForm(p => ({ ...p, description: e.target.value }))} /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowExamModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ width: 'auto' }}>{saving ? 'Saving…' : (editExam ? 'Save' : 'Create')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Paper modal */}
      {showPaperModal && (
        <div className="modal-overlay" onClick={() => setShowPaperModal(false)}>
          <div className="modal" onClick={ev => ev.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h3>
                {(() => {
                  const syllabusOnly = isTeacher || (editPaper && editPaper._syllabusOnly);
                  if (syllabusOnly) return (editPaper && editPaper.syllabus ? 'Edit Syllabus' : 'Add Syllabus');
                  return editPaper ? 'Edit Paper' : 'Add Paper to Timetable';
                })()}
              </h3>
              <button className="btn-icon" onClick={() => setShowPaperModal(false)}><FiX /></button>
            </div>
            <form onSubmit={savePaper}>
              <div className="modal-body">
                {(isTeacher || (editPaper && editPaper._syllabusOnly)) && editPaper ? (
                  // Teacher view — read-only paper info, only syllabus editable
                  <>
                    <div style={{ background: 'var(--gray-50)', padding: 12, borderRadius: 'var(--radius-md)', marginBottom: 12, fontSize: '0.85rem' }}>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>{editPaper.subject_name}</div>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', color: 'var(--gray-600)', fontSize: '0.78rem' }}>
                        <span><FiCalendar size={10} /> {formatDate(editPaper.date)}</span>
                        {editPaper.start_time && <span><FiClock size={10} /> {editPaper.start_time}</span>}
                        {editPaper.duration_minutes && <span>{editPaper.duration_minutes} min</span>}
                        {editPaper.room && <span><FiMapPin size={10} /> {editPaper.room}</span>}
                        <span>Max {editPaper.max_marks} · Pass {editPaper.passing_marks}</span>
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Syllabus / Topics *</label>
                      <textarea className="form-input" rows={6} required placeholder="Chapters, topics, key concepts covered in this paper…" value={paperForm.syllabus} onChange={e => setPaperForm((p: any) => ({ ...p, syllabus: e.target.value }))} />
                      <p style={{ fontSize: '0.7rem', color: 'var(--gray-400)', marginTop: 4 }}>Schedule, marks and room are set by the admin and can't be changed here.</p>
                    </div>
                  </>
                ) : (
                  // Admin view — full editor
                  <>
                    <div className="form-group">
                      <label>Subject *</label>
                      <select className="form-input" required value={paperForm.subject_id} onChange={e => setPaperForm((p: any) => ({ ...p, subject_id: e.target.value }))}>
                        <option value="">Select subject…</option>
                        {classSubjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div className="form-group">
                        <label>Exam Date *</label>
                        <input
                          className="form-input" type="date" required
                          value={paperForm.date}
                          min={detail?.start_date || undefined}
                          max={detail?.end_date || detail?.start_date || undefined}
                          onChange={e => setPaperForm((p: any) => ({ ...p, date: e.target.value }))}
                        />
                        {detail?.start_date && (
                          <p style={{ fontSize: '0.7rem', color: 'var(--gray-400)', marginTop: 3 }}>
                            Must be between {formatDate(detail.start_date)}
                            {detail.end_date ? ` and ${formatDate(detail.end_date)}` : ''}
                          </p>
                        )}
                      </div>
                      <div className="form-group"><label>Start Time</label><input className="form-input" type="time" value={paperForm.start_time} onChange={e => setPaperForm((p: any) => ({ ...p, start_time: e.target.value }))} /></div>
                      <div className="form-group"><label>Duration (min)</label><input className="form-input" type="number" min="0" value={paperForm.duration_minutes} onChange={e => setPaperForm((p: any) => ({ ...p, duration_minutes: e.target.value }))} /></div>
                      <div className="form-group"><label>Room / Hall</label><input className="form-input" placeholder="Hall A" value={paperForm.room} onChange={e => setPaperForm((p: any) => ({ ...p, room: e.target.value }))} /></div>
                      <div className="form-group"><label>Max Marks *</label><input className="form-input" type="number" min="1" required value={paperForm.max_marks} onChange={e => setPaperForm((p: any) => ({ ...p, max_marks: e.target.value }))} /></div>
                      <div className="form-group"><label>Passing Marks *</label><input className="form-input" type="number" min="0" required value={paperForm.passing_marks} onChange={e => setPaperForm((p: any) => ({ ...p, passing_marks: e.target.value }))} /></div>
                    </div>
                    <div className="form-group">
                      <label>Syllabus / Topics <span style={{ fontSize: '0.7rem', color: 'var(--gray-400)' }}>(usually filled by the teacher)</span></label>
                      <textarea className="form-input" rows={3} placeholder="Will be filled by the assigned teacher…" value={paperForm.syllabus} onChange={e => setPaperForm((p: any) => ({ ...p, syllabus: e.target.value }))} />
                    </div>
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowPaperModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ width: 'auto' }}>{saving ? 'Saving…' : (editPaper ? 'Save' : 'Add Paper')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Marks entry modal */}
      {marksPaper && (
        <div className="modal-overlay" onClick={() => { setMarksPaper(null); setMarksheet(null); }}>
          <div className="modal" onClick={ev => ev.stopPropagation()} style={{ maxWidth: 620 }}>
            <div className="modal-header">
              <div>
                <h3>Enter Marks — {marksheet?.paper?.subject_name || ''}</h3>
                {marksheet?.paper && <p style={{ fontSize: '0.76rem', color: 'var(--gray-500)', margin: '2px 0 0' }}>{marksheet.paper.exam_name} · Max {marksheet.paper.max_marks} · Pass {marksheet.paper.passing_marks}</p>}
              </div>
              <button className="btn-icon" onClick={() => { setMarksPaper(null); setMarksheet(null); }}><FiX /></button>
            </div>
            <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {marksLoading ? (
                <div className="spinner-container"><div className="spinner" /></div>
              ) : !marksheet || marksheet.students.length === 0 ? (
                <div className="empty-state"><p>No students found for this class.</p></div>
              ) : (
                <table className="data-table" style={{ width: '100%' }}>
                  <thead><tr><th>Roll</th><th>Student</th><th>Marks</th><th>Absent</th></tr></thead>
                  <tbody>
                    {marksheet.students.map((s: any) => {
                      const max = marksheet.paper.max_marks;
                      const pass = marksheet.paper.passing_marks;
                      const failing = !s.is_absent && s.marks_obtained !== '' && s.marks_obtained != null && Number(s.marks_obtained) < pass;
                      return (
                        <tr key={s.student_id}>
                          <td style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>{s.roll_no || '—'}</td>
                          <td>
                            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{s.name}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--gray-400)' }}>{s.admission_no}</div>
                          </td>
                          <td>
                            <input
                              type="number" min="0" max={max} disabled={s.is_absent}
                              value={s.is_absent ? '' : (s.marks_obtained ?? '')}
                              onChange={e => setMark(s.student_id, 'marks_obtained', e.target.value)}
                              style={{ width: 80, padding: '4px 8px', border: `1.5px solid ${failing ? 'var(--danger-400)' : 'var(--gray-200)'}`, borderRadius: 6, color: failing ? 'var(--danger-600)' : 'inherit', fontWeight: failing ? 700 : 400 }}
                              placeholder={s.is_absent ? 'AB' : '—'}
                            />
                            <span style={{ fontSize: '0.7rem', color: 'var(--gray-400)', marginLeft: 4 }}>/ {max}</span>
                          </td>
                          <td>
                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: '0.78rem' }}>
                              <input type="checkbox" checked={!!s.is_absent} onChange={e => setMark(s.student_id, 'is_absent', e.target.checked)} />
                              Absent
                            </label>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => { setMarksPaper(null); setMarksheet(null); }}>Cancel</button>
              <button type="button" className="btn btn-primary" disabled={saving || !marksheet?.students?.length} onClick={saveMarks} style={{ width: 'auto' }}><FiSave /> {saving ? 'Saving…' : 'Save Marks'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" onClick={ev => ev.stopPropagation()} style={{ maxWidth: 360 }}>
            <div className="modal-header"><h3>Confirm Delete</h3><button className="btn-icon" onClick={() => setDeleteConfirm(null)}><FiX /></button></div>
            <div className="modal-body"><p>{deleteConfirm.type === 'exam' ? 'Delete this exam, all its papers and results? This cannot be undone.' : 'Delete this paper and its results?'}</p></div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => deleteConfirm.type === 'exam' ? deleteExam(deleteConfirm.id) : deletePaper(deleteConfirm.id)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Rankings / Leaderboard modal */}
      {rankingsExamId && (
        <ExamRankings examId={rankingsExamId} onClose={() => setRankingsExamId(null)} />
      )}
    </div>
  );
}
