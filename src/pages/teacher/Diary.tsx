import React, { useEffect, useMemo, useState } from 'react';
import {
  FiBookOpen, FiPlus, FiCalendar, FiClock, FiTrash2, FiEdit2,
  FiFeather, FiSave, FiX, FiCheckCircle, FiAlertCircle, FiFileText, FiPaperclip,
  FiImage,
} from 'react-icons/fi';
import client from '../../api/client';
import DiaryImageUploader, { DiaryAttachment } from '../../components/DiaryImageUploader';
import DiaryImageGrid from '../../components/DiaryImageGrid';

interface TeachingSection {
  section_id: string;
  section_name: string;
  is_class_teacher: boolean;
  subject_ids: string[];   // subjects this teacher teaches IN this section
}
interface ClassRow {
  class_id: string;
  class_name: string;
  grade_level: number;
  subjects: { id: string; name: string; code: string }[];
  is_class_teacher_of_sections: string[];
  teaching_sections?: TeachingSection[];
}
interface SectionInfo {
  section_id: string;
  section_name: string;
  class_id: string;
  class_name: string;
  grade_level: number;
  student_count: number;
}
interface DiaryEntry {
  id: string;
  section_id: string;
  subject_id: string;
  subject_name?: string;
  teacher_name?: string;
  entry_date: string;
  period_number?: number | null;
  period_label?: string | null;
  classwork?: string | null;
  homework?: string | null;
  homework_due_date?: string | null;
  remarks?: string | null;
  remarks_date?: string | null;
  attachment_url?: string | null;
  attachments?: DiaryAttachment[] | null;
  color?: string | null;
  section_label?: string | null;
  created_at: string;
}

const PALETTE = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#ef4444'];

const todayStr = () => new Date().toISOString().split('T')[0];

export default function TeacherDiary() {
  // Booted data
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [ctSections, setCtSections] = useState<SectionInfo[]>([]);
  const [adminSections, setAdminSections] = useState<{ section_id: string; class_id: string; class_name: string; section_name: string }[]>([]);
  const [adminSubjects, setAdminSubjects] = useState<Record<string, { id: string; name: string; code: string }[]>>({});
  const [bootLoading, setBootLoading] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Form
  const [date, setDate] = useState(todayStr());
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [periodNumber, setPeriodNumber] = useState<string>('');
  const [periodLabel, setPeriodLabel] = useState('');
  const [classwork, setClasswork] = useState('');
  const [homework, setHomework] = useState('');
  const [homeworkDue, setHomeworkDue] = useState('');
  const [remarks, setRemarks] = useState('');
  const [remarksDate, setRemarksDate] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [attachments, setAttachments] = useState<DiaryAttachment[]>([]);
  const [color, setColor] = useState(PALETTE[0]);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Existing entries
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [listLoading, setListLoading] = useState(false);

  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const showToast = (kind: 'ok' | 'err', msg: string) => {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Boot ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Try teacher endpoint first
        const r = await client.get('/staff/my/classes');
        if (cancelled) return;
        const list: ClassRow[] = r.data?.classes || [];
        const ct: SectionInfo[] = r.data?.class_teacher_of || [];
        setClasses(list);
        setCtSections(ct);
        if (list.length === 0 && ct.length === 0) {
          setBootError('You have no classes assigned. Ask your admin to add subjects or set you as class teacher.');
        }
      } catch (err: any) {
        // Admin fallback — load all classes + subjects + sections
        if (err?.response?.status === 403) {
          setIsAdmin(true);
          try {
            const [clsR, secR, subR] = await Promise.all([
              client.get('/classes'),
              client.get('/sections'),
              client.get('/subjects'),
            ]);
            const clsList = Array.isArray(clsR.data) ? clsR.data : (clsR.data?.classes || []);
            const secList = Array.isArray(secR.data) ? secR.data : (secR.data?.sections || []);
            const subList = Array.isArray(subR.data) ? subR.data : (subR.data?.subjects || []);
            const subjMap: Record<string, { id: string; name: string; code: string }[]> = {};
            subList.forEach((s: any) => {
              const cid = s.class_id;
              if (!cid) return;
              if (!subjMap[cid]) subjMap[cid] = [];
              subjMap[cid].push({ id: s.id, name: s.name, code: s.code });
            });
            const clsMap = new Map(clsList.map((c: any) => [c.id, c]));
            const flatSec = secList.map((sec: any) => {
              const cls: any = clsMap.get(sec.class_id);
              return {
                section_id: sec.id,
                class_id: sec.class_id,
                class_name: cls?.name || '',
                section_name: sec.name,
              };
            });
            setAdminSections(flatSec);
            setAdminSubjects(subjMap);
            const classesForForm: ClassRow[] = clsList.map((c: any) => ({
              class_id: c.id, class_name: c.name, grade_level: c.grade_level,
              subjects: subjMap[c.id] || [], is_class_teacher_of_sections: [],
            }));
            setClasses(classesForForm);
          } catch {
            setBootError('Failed to load classes.');
          }
        } else {
          setBootError('Failed to load your classes.');
        }
      } finally {
        if (!cancelled) setBootLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Sections available for the chosen class — for teachers we use the
  // backend-derived `teaching_sections` (sections where they actually teach
  // OR are class teacher of). No extra round-trip needed.
  const sectionsForClass = useMemo(() => {
    if (!classId) return [];
    if (isAdmin) {
      return adminSections
        .filter(s => s.class_id === classId)
        .map(s => ({ id: s.section_id, label: `Section ${s.section_name}` }));
    }
    const cls = classes.find(c => c.class_id === classId);
    const ts = cls?.teaching_sections || [];
    return ts.map(s => ({
      id: s.section_id,
      label: `Section ${s.section_name}${s.is_class_teacher ? ' · class-teacher' : ''}`,
    }));
  }, [classId, classes, adminSections, isAdmin]);

  // Subjects available for the chosen class+section.
  //
  // - Admin: every subject in the class.
  // - Class teacher with no scheduled subject in the section: every subject in
  //   the class (so the class teacher can post diary entries on behalf of
  //   anyone — common for primary classes).
  // - Otherwise: only subjects this teacher actually teaches in THIS section
  //   (from the timetable).
  const subjectsForClass = useMemo(() => {
    if (!classId) return [];
    const cls = classes.find(c => c.class_id === classId);
    if (!cls) return [];
    if (isAdmin) return cls.subjects || [];

    if (!sectionId) return cls.subjects || [];
    const ts = (cls.teaching_sections || []).find(s => s.section_id === sectionId);
    if (!ts) return [];
    // Class teacher with no scheduled subject → allow all class subjects.
    if (ts.is_class_teacher && ts.subject_ids.length === 0) {
      return cls.subjects || [];
    }
    const allowed = new Set(ts.subject_ids);
    return (cls.subjects || []).filter(s => allowed.has(s.id));
  }, [classId, sectionId, classes, isAdmin]);

  // If the chosen subject is no longer valid after section change, clear it.
  useEffect(() => {
    if (subjectId && !subjectsForClass.find(s => s.id === subjectId)) {
      setSubjectId('');
    }
  }, [subjectsForClass, subjectId]);

  // Auto-select sole option
  useEffect(() => {
    if (sectionsForClass.length === 1) setSectionId(sectionsForClass[0].id);
  }, [sectionsForClass]);
  useEffect(() => {
    if (subjectsForClass.length === 1) setSubjectId(subjectsForClass[0].id);
  }, [subjectsForClass]);

  // ── Load entries for selected section + date ────────────────────────────
  useEffect(() => {
    if (!sectionId || !date) { setEntries([]); return; }
    setListLoading(true);
    client.get('/diary', { params: { section_id: sectionId, entry_date: date } })
      .then(r => setEntries(Array.isArray(r.data) ? r.data : []))
      .catch(() => setEntries([]))
      .finally(() => setListLoading(false));
  }, [sectionId, date]);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const resetForm = () => {
    setEditingId(null);
    setPeriodNumber(''); setPeriodLabel('');
    setClasswork(''); setHomework(''); setHomeworkDue('');
    setRemarks(''); setRemarksDate(''); setAttachmentUrl('');
    setAttachments([]);
    setColor(PALETTE[0]);
  };

  const startEdit = (e: DiaryEntry) => {
    setEditingId(e.id);
    setSubjectId(e.subject_id);
    setPeriodNumber(e.period_number ? String(e.period_number) : '');
    setPeriodLabel(e.period_label || '');
    setClasswork(e.classwork || '');
    setHomework(e.homework || '');
    setHomeworkDue(e.homework_due_date || '');
    setRemarks(e.remarks || '');
    setRemarksDate(e.remarks_date || '');
    setAttachmentUrl(e.attachment_url || '');
    setAttachments(Array.isArray(e.attachments) ? e.attachments : []);
    setColor(e.color || PALETTE[0]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = async () => {
    if (!sectionId || !subjectId || !date) {
      showToast('err', 'Select date, section, and subject');
      return;
    }
    if (!classwork && !homework && !remarks) {
      showToast('err', 'Add classwork, homework, or remarks');
      return;
    }
    setSaving(true);
    try {
      const body: any = {
        section_id: sectionId,
        subject_id: subjectId,
        entry_date: date,
        period_number: periodNumber ? Number(periodNumber) : null,
        period_label: periodLabel || null,
        classwork: classwork || null,
        homework: homework || null,
        homework_due_date: homeworkDue || null,
        remarks: remarks || null,
        remarks_date: remarksDate || null,
        attachment_url: attachmentUrl || null,
        attachments: attachments.length > 0 ? attachments : null,
        color,
      };
      if (editingId) {
        const patch: any = { ...body };
        delete patch.section_id;
        delete patch.subject_id;
        delete patch.entry_date;
        await client.patch(`/diary/${editingId}`, patch);
        showToast('ok', 'Entry updated');
      } else {
        await client.post('/diary', body);
        showToast('ok', 'Entry posted to the diary');
      }
      resetForm();
      // Refresh list
      const r = await client.get('/diary', { params: { section_id: sectionId, entry_date: date } });
      setEntries(Array.isArray(r.data) ? r.data : []);
    } catch (err: any) {
      showToast('err', err?.response?.data?.detail || 'Failed to save entry');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this diary entry?')) return;
    try {
      await client.delete(`/diary/${id}`);
      setEntries(prev => prev.filter(e => e.id !== id));
      showToast('ok', 'Entry deleted');
    } catch (err: any) {
      showToast('err', err?.response?.data?.detail || 'Failed to delete');
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────
  if (bootLoading) {
    return <div className="card"><div className="spinner-container"><div className="spinner" /></div></div>;
  }
  if (bootError) {
    return (
      <div>
        <div className="page-header"><h1>📓 Daily Diary</h1></div>
        <div className="card"><div className="empty-state"><FiAlertCircle size={32} /><h3>{bootError}</h3></div></div>
      </div>
    );
  }

  return (
    <div className="diary-page">
      <div className="page-header">
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FiBookOpen /> Daily Diary
          </h1>
          <p style={{ color: 'var(--gray-500)', margin: '4px 0 0', fontSize: '0.9rem' }}>
            Post what was taught and the homework for each period — parents & students see it instantly.
          </p>
        </div>
      </div>

      {toast && (
        <div className={`diary-toast ${toast.kind}`}>
          {toast.kind === 'ok' ? <FiCheckCircle /> : <FiAlertCircle />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Compose card — looks like a diary page */}
      <div className="diary-compose">
        <div className="diary-compose-header">
          <div className="diary-compose-title">
            <FiFeather />
            <span>{editingId ? 'Edit entry' : 'New diary entry'}</span>
          </div>
          {editingId && (
            <button className="btn btn-sm" onClick={resetForm} style={{ width: 'auto' }}>
              <FiX /> Cancel edit
            </button>
          )}
        </div>

        {/* Filters row */}
        <div className="diary-form-row">
          <div className="diary-form-field">
            <label><FiCalendar /> Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="diary-form-field">
            <label>Class</label>
            <select value={classId} onChange={e => { setClassId(e.target.value); setSectionId(''); setSubjectId(''); }}>
              <option value="">Select class…</option>
              {classes
                .slice()
                .sort((a, b) => a.grade_level - b.grade_level)
                .map(c => <option key={c.class_id} value={c.class_id}>{c.class_name}</option>)
              }
            </select>
          </div>
          <div className="diary-form-field">
            <label>Section</label>
            <select value={sectionId} onChange={e => setSectionId(e.target.value)} disabled={!classId || sectionsForClass.length === 0}>
              <option value="">{sectionsForClass.length === 0 && classId ? 'No sections assigned' : 'Select section…'}</option>
              {sectionsForClass.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div className="diary-form-field">
            <label>Subject</label>
            <select value={subjectId} onChange={e => setSubjectId(e.target.value)} disabled={!sectionId || subjectsForClass.length === 0}>
              <option value="">
                {!sectionId ? 'Pick section first' :
                  subjectsForClass.length === 0 ? 'No subjects in this section' :
                  'Select subject…'}
              </option>
              {subjectsForClass.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="diary-form-field" style={{ maxWidth: 120 }}>
            <label><FiClock /> Period #</label>
            <input
              type="number" min={1} max={20}
              placeholder="e.g. 3"
              value={periodNumber}
              onChange={e => setPeriodNumber(e.target.value)}
            />
          </div>
          <div className="diary-form-field">
            <label>Period label (optional)</label>
            <input
              type="text"
              placeholder="e.g. 3rd Period · 10:30–11:15"
              value={periodLabel}
              onChange={e => setPeriodLabel(e.target.value)}
            />
          </div>
        </div>

        {/* Two-column writing area */}
        <div className="diary-writing-area">
          <div className="diary-page-sheet" style={{ borderLeftColor: color }}>
            <div className="diary-page-section">
              <div className="diary-section-label">📚 Classwork — what was taught</div>
              <textarea
                placeholder="Today we covered…"
                value={classwork}
                onChange={e => setClasswork(e.target.value)}
                rows={5}
                className="diary-textarea"
              />
            </div>
            <div className="diary-page-section">
              <div className="diary-section-label">📝 Homework — to be submitted</div>
              <textarea
                placeholder="Solve exercise 4 questions 1-10 from Chapter 5"
                value={homework}
                onChange={e => setHomework(e.target.value)}
                rows={5}
                className="diary-textarea"
              />
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ fontSize: '0.78rem', color: 'var(--gray-500)' }}>Due:</label>
                <input
                  type="date" value={homeworkDue}
                  onChange={e => setHomeworkDue(e.target.value)}
                  style={{ maxWidth: 170 }}
                />
              </div>
            </div>
            <div className="diary-page-section">
              <div className="diary-section-label">💡 Remarks / Announcements (optional)</div>
              <textarea
                placeholder="Bring graph paper tomorrow. Quiz on Friday."
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                rows={2}
                className="diary-textarea"
              />
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ fontSize: '0.78rem', color: 'var(--gray-500)' }}>Reminder for:</label>
                <input
                  type="date" value={remarksDate}
                  onChange={e => setRemarksDate(e.target.value)}
                  style={{ maxWidth: 170 }}
                />
              </div>
            </div>
            <div className="diary-page-section">
              <div className="diary-section-label">
                <FiImage style={{ verticalAlign: '-2px', marginRight: 4 }} />
                Images (homework / worksheet photos)
              </div>
              <DiaryImageUploader
                value={attachments}
                onChange={setAttachments}
                disabled={saving}
                max={8}
              />
            </div>
            <div className="diary-page-section diary-meta-row">
              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={{ fontSize: '0.78rem', color: 'var(--gray-500)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <FiPaperclip /> External link (Drive, YouTube — optional)
                </label>
                <input
                  type="url"
                  placeholder="https://…"
                  value={attachmentUrl}
                  onChange={e => setAttachmentUrl(e.target.value)}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.78rem', color: 'var(--gray-500)' }}>Tag color</label>
                <div className="diary-color-row">
                  {PALETTE.map(c => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={`diary-color-dot ${color === c ? 'active' : ''}`}
                      style={{ background: c }}
                      type="button"
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="diary-compose-actions">
          <button
            className="btn btn-primary"
            disabled={saving || !sectionId || !subjectId}
            onClick={handleSave}
            style={{ width: 'auto', minWidth: 200 }}
          >
            <FiSave /> {saving ? 'Saving…' : editingId ? 'Update entry' : 'Post to diary'}
          </button>
        </div>
      </div>

      {/* Existing entries */}
      <div className="diary-existing">
        <div className="diary-existing-header">
          <h3 style={{ margin: 0 }}>
            <FiFileText /> Entries for {date} {sectionId ? '· ' + (sectionsForClass.find(s => s.id === sectionId)?.label || '') : ''}
          </h3>
          <span className="badge badge-info">{entries.length}</span>
        </div>
        {!sectionId ? (
          <div className="empty-state"><p>Pick a class &amp; section to see today's entries.</p></div>
        ) : listLoading ? (
          <div className="spinner-container"><div className="spinner" /></div>
        ) : entries.length === 0 ? (
          <div className="empty-state"><p>No diary entries yet for this date. Be the first to post.</p></div>
        ) : (
          <div className="diary-entry-grid">
            {entries.map(e => (
              <div key={e.id} className="diary-entry-card" style={{ borderLeftColor: e.color || '#6366f1' }}>
                <div className="diary-entry-card-head">
                  <div>
                    <div className="diary-entry-subject">{e.subject_name || 'Subject'}</div>
                    <div className="diary-entry-period">
                      {e.period_label || (e.period_number ? `Period ${e.period_number}` : 'No period')}
                      {e.teacher_name ? ' · ' + e.teacher_name : ''}
                    </div>
                  </div>
                  <div className="diary-entry-actions">
                    <button onClick={() => startEdit(e)} title="Edit" className="diary-icon-btn"><FiEdit2 /></button>
                    <button onClick={() => handleDelete(e.id)} title="Delete" className="diary-icon-btn danger"><FiTrash2 /></button>
                  </div>
                </div>
                {e.classwork && (<div className="diary-entry-block"><span className="diary-tag">Classwork</span><p>{e.classwork}</p></div>)}
                {e.homework && (
                  <div className="diary-entry-block">
                    <span className="diary-tag homework">Homework{e.homework_due_date ? ` · due ${e.homework_due_date}` : ''}</span>
                    <p>{e.homework}</p>
                  </div>
                )}
                {e.remarks && (
                  <div className="diary-entry-block">
                    <span className="diary-tag remarks">Remarks{e.remarks_date ? ` · for ${e.remarks_date}` : ''}</span>
                    <p>{e.remarks}</p>
                  </div>
                )}
                {Array.isArray(e.attachments) && e.attachments.length > 0 && (
                  <div className="diary-entry-block">
                    <span className="diary-tag" style={{ background: '#eef2ff', color: '#4338ca' }}>
                      {e.attachments.length} attachment{e.attachments.length > 1 ? 's' : ''}
                    </span>
                    <DiaryImageGrid
                      images={e.attachments}
                      compact
                      entryDate={e.entry_date}
                      subjectName={e.subject_name}
                    />
                  </div>
                )}
                {e.attachment_url && (
                  <a href={e.attachment_url} target="_blank" rel="noreferrer" className="diary-entry-attachment">
                    <FiPaperclip /> View attachment
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
