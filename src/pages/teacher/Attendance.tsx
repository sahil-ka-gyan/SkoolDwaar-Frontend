import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FiCheck, FiX, FiClock, FiSunrise, FiUserCheck, FiUsers, FiCalendar,
  FiSearch, FiCopy, FiRotateCcw, FiSave, FiChevronLeft, FiChevronRight,
  FiEdit3, FiAlertCircle, FiCheckCircle,
} from 'react-icons/fi';
import client from '../../api/client';
import { getInitials } from '../../utils/helpers';

type Status = 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY';

const STATUS_CONFIG: Record<Status, { label: string; short: string; color: string; bg: string; icon: React.ReactElement }> = {
  PRESENT:  { label: 'Present',  short: 'P', color: '#059669', bg: '#d1fae5', icon: <FiCheck size={14} /> },
  ABSENT:   { label: 'Absent',   short: 'A', color: '#e11d48', bg: '#ffe4e6', icon: <FiX size={14} /> },
  LATE:     { label: 'Late',     short: 'L', color: '#d97706', bg: '#fef3c7', icon: <FiClock size={14} /> },
  HALF_DAY: { label: 'Half Day', short: 'H', color: '#7c3aed', bg: '#ede9fe', icon: <FiSunrise size={14} /> },
};
const STATUSES: Status[] = ['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY'];
const AVATAR_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9', '#ec4899', '#14b8a6'];

interface SectionInfo {
  section_id: string;
  section_name: string;
  class_id: string;
  class_name: string;
  grade_level: number;
  student_count: number;
}

interface Roster {
  student_id: string;
  admission_no: string;
  roll_no: string | null;
  name: string;
}

type Tab = 'mark' | 'history';

export default function TeacherAttendance() {
  const [tab, setTab] = useState<Tab>('mark');

  // Sections the teacher is class-teacher of
  const [sections, setSections] = useState<SectionInfo[]>([]);
  const [sectionId, setSectionId] = useState('');
  const [bootLoading, setBootLoading] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);

  // Marking state
  const todayStr = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(todayStr);
  const [roster, setRoster] = useState<Roster[]>([]);
  const [marks, setMarks] = useState<Record<string, Status>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [originalMarks, setOriginalMarks] = useState<Record<string, Status>>({});
  const [rosterLoading, setRosterLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [editingRemarks, setEditingRemarks] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  // History state
  const now = new Date();
  const [histMonth, setHistMonth] = useState(now.getMonth() + 1);
  const [histYear, setHistYear] = useState(now.getFullYear());
  const [histSummary, setHistSummary] = useState<any>(null);
  const [histLoading, setHistLoading] = useState(false);
  const [histStudent, setHistStudent] = useState<any>(null);
  const [histCalData, setHistCalData] = useState<any[]>([]);

  // ── Boot: load teacher's sections ───────────────────────────────────────────
  useEffect(() => {
    client.get('/staff/my/classes')
      .then(r => {
        const list: SectionInfo[] = r.data?.class_teacher_of || [];
        setSections(list);
        if (list.length === 1) setSectionId(list[0].section_id);
        else if (list.length === 0) setBootError('You are not assigned as class teacher for any section. Please contact your school admin.');
      })
      .catch(() => setBootError('Failed to load your sections. Please try again.'))
      .finally(() => setBootLoading(false));
  }, []);

  // Holiday for the selected date
  const [dateHoliday, setDateHoliday] = useState<any>(null);
  useEffect(() => {
    if (!date) { setDateHoliday(null); return; }
    client.get(`/holidays/on/${date}`)
      .then(r => setDateHoliday(r.data || null))
      .catch(() => setDateHoliday(null));
  }, [date]);

  // ── Roster + existing marks for date ────────────────────────────────────────
  const loadRoster = useCallback(async () => {
    if (!sectionId) return;
    setRosterLoading(true);
    try {
      const [sumR, classR] = await Promise.all([
        client.get(`/attendance/summary?section_id=${sectionId}`).catch(() => ({ data: null })),
        client.get(`/attendance/class/${sectionId}?attendance_date=${date}`).catch(() => ({ data: [] })),
      ]);
      const list: Roster[] = (sumR.data?.records || []).map((r: any) => ({
        student_id: r.student_id,
        admission_no: r.admission_no,
        roll_no: r.roll_no,
        name: r.name,
      })).sort((a: Roster, b: Roster) => {
        const ra = parseInt(a.roll_no || '999999', 10);
        const rb = parseInt(b.roll_no || '999999', 10);
        if (ra !== rb) return ra - rb;
        return a.name.localeCompare(b.name);
      });
      setRoster(list);

      const m: Record<string, Status> = {};
      const r: Record<string, string> = {};
      (classR.data || []).forEach((row: any) => {
        m[row.student_id] = row.status as Status;
        if (row.remarks) r[row.student_id] = row.remarks;
      });
      setMarks(m);
      setRemarks(r);
      setOriginalMarks({ ...m });
    } finally {
      setRosterLoading(false);
    }
  }, [sectionId, date]);

  useEffect(() => { loadRoster(); }, [loadRoster]);

  // ── Stats ───────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const c = { PRESENT: 0, ABSENT: 0, LATE: 0, HALF_DAY: 0, marked: 0 };
    roster.forEach(s => {
      const st = marks[s.student_id];
      if (st) { c[st]++; c.marked++; }
    });
    return { ...c, unmarked: roster.length - c.marked, total: roster.length };
  }, [marks, roster]);

  const hasChanges = useMemo(() => {
    const keys = new Set([...Object.keys(marks), ...Object.keys(originalMarks)]);
    for (const k of keys) if (marks[k] !== originalMarks[k]) return true;
    return false;
  }, [marks, originalMarks]);

  // ── Mark actions ────────────────────────────────────────────────────────────
  const setStatus = (id: string, s: Status) => {
    setMarks(prev => ({ ...prev, [id]: s }));
  };

  const markAllPresent = () => {
    const next: Record<string, Status> = { ...marks };
    roster.forEach(s => { if (!next[s.student_id]) next[s.student_id] = 'PRESENT'; });
    setMarks(next);
  };

  const resetUnsaved = () => {
    setMarks({ ...originalMarks });
    setRemarks({});
  };

  const copyFromYesterday = async () => {
    if (!sectionId) return;
    // Find the most recent working date with attendance (up to 7 days back)
    for (let d = 1; d <= 7; d++) {
      const candidate = new Date(date);
      candidate.setDate(candidate.getDate() - d);
      const dStr = candidate.toISOString().split('T')[0];
      const r = await client.get(`/attendance/class/${sectionId}?attendance_date=${dStr}`).catch(() => ({ data: [] }));
      if (r.data && r.data.length > 0) {
        const next: Record<string, Status> = { ...marks };
        r.data.forEach((row: any) => {
          // Only overwrite unmarked entries to preserve already-marked work
          if (!next[row.student_id]) next[row.student_id] = row.status as Status;
        });
        setMarks(next);
        setToast({ kind: 'ok', msg: `Filled unmarked rows from ${dStr}` });
        setTimeout(() => setToast(null), 2500);
        return;
      }
    }
    setToast({ kind: 'err', msg: 'No previous attendance found in the last 7 days' });
    setTimeout(() => setToast(null), 2500);
  };

  const submit = async () => {
    if (!sectionId || stats.marked === 0) return;
    setSaving(true);
    try {
      const entries = roster
        .filter(s => marks[s.student_id])
        .map(s => ({
          student_id: s.student_id,
          status: marks[s.student_id],
          remarks: remarks[s.student_id] || null,
        }));
      await client.post('/attendance/mark', { date, entries });
      setOriginalMarks({ ...marks });
      setToast({ kind: 'ok', msg: `Saved attendance for ${entries.length} student${entries.length === 1 ? '' : 's'}` });
      setTimeout(() => setToast(null), 2500);
    } catch (e: any) {
      setToast({ kind: 'err', msg: e?.response?.data?.detail || 'Failed to save attendance' });
      setTimeout(() => setToast(null), 3500);
    } finally {
      setSaving(false);
    }
  };

  // ── History tab ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (tab !== 'history' || !sectionId) return;
    setHistLoading(true);
    client.get(`/attendance/summary?section_id=${sectionId}&month=${histMonth}&year=${histYear}`)
      .then(r => setHistSummary(r.data))
      .catch(() => setHistSummary(null))
      .finally(() => setHistLoading(false));
  }, [tab, sectionId, histMonth, histYear]);

  const loadStudentCalendar = async (s: any) => {
    setHistStudent(s);
    const r = await client.get(`/attendance/student/${s.student_id}?year=${histYear}&month=${histMonth}`).catch(() => ({ data: [] }));
    setHistCalData(r.data || []);
  };

  const navHistMonth = (dir: number) => {
    let m = histMonth + dir, y = histYear;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    setHistMonth(m); setHistYear(y);
    setHistStudent(null);
  };

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const getDaysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();
  const getFirstDay = (y: number, m: number) => new Date(y, m - 1, 1).getDay();

  // ── Filtering ───────────────────────────────────────────────────────────────
  const filteredRoster = useMemo(() => {
    if (!search.trim()) return roster;
    const q = search.toLowerCase();
    return roster.filter(s => `${s.name} ${s.admission_no} ${s.roll_no || ''}`.toLowerCase().includes(q));
  }, [roster, search]);

  const activeSection = sections.find(s => s.section_id === sectionId);
  const isPastDate = date < todayStr;
  const isFutureDate = date > todayStr;

  // ── Render: boot states ─────────────────────────────────────────────────────
  if (bootLoading) {
    return (
      <div className="card"><div className="spinner-container"><div className="spinner" /></div></div>
    );
  }
  if (bootError) {
    return (
      <div>
        <div className="page-header"><h1>Attendance</h1></div>
        <div className="card">
          <div className="empty-state">
            <FiAlertCircle size={32} style={{ color: 'var(--danger-400)' }} />
            <h3>Cannot mark attendance</h3>
            <p>{bootError}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
          padding: '12px 18px', borderRadius: 'var(--radius-md)',
          background: toast.kind === 'ok' ? 'var(--success-600)' : 'var(--danger-600)',
          color: '#fff', fontSize: '0.88rem', fontWeight: 600,
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {toast.kind === 'ok' ? <FiCheckCircle /> : <FiAlertCircle />} {toast.msg}
        </div>
      )}

      <div className="page-header">
        <div>
          <h1>📋 Attendance</h1>
          <p style={{ color: 'var(--gray-400)', fontSize: '0.85rem', margin: '4px 0 0' }}>
            Mark daily attendance for your class. Re-submit any time to update.
          </p>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'mark' ? 'active' : ''}`} onClick={() => setTab('mark')}>Mark Today</button>
        <button className={`tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>History & Calendar</button>
      </div>

      {/* ─── Section + Date controls (shared) ─── */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-body" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--gray-600)', display: 'block', marginBottom: 4 }}>
              Class / Section
            </label>
            <select className="form-input" value={sectionId} onChange={e => setSectionId(e.target.value)} disabled={sections.length === 0}>
              {sections.length > 1 && <option value="">Select…</option>}
              {sections.map(s => (
                <option key={s.section_id} value={s.section_id}>
                  {s.class_name} – Section {s.section_name} ({s.student_count} students)
                </option>
              ))}
            </select>
          </div>
          {tab === 'mark' && (
            <div className="form-group" style={{ minWidth: 180, marginBottom: 0 }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--gray-600)', display: 'block', marginBottom: 4 }}>
                Date
              </label>
              <input type="date" className="form-input" value={date} max={todayStr} onChange={e => setDate(e.target.value)} />
            </div>
          )}
          {tab === 'mark' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--gray-500)', paddingBottom: 6 }}>
              <FiCalendar size={14} />
              <span>{new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
              {isPastDate && <span className="badge badge-warning" style={{ fontSize: '0.68rem' }}>Editing past date</span>}
              {isFutureDate && <span className="badge badge-danger" style={{ fontSize: '0.68rem' }}>Future date</span>}
            </div>
          )}
        </div>
      </div>

      {!sectionId ? (
        <div className="card">
          <div className="empty-state">
            <FiUsers size={32} style={{ color: 'var(--gray-300)' }} />
            <h3>Select a section</h3>
            <p>Choose the class section you teach to start.</p>
          </div>
        </div>
      ) : tab === 'mark' ? (
        <>
          {/* Holiday banner */}
          {dateHoliday && (
            <div className="card" style={{
              marginBottom: '1rem', padding: 18,
              background: 'linear-gradient(135deg, #fee2e2 0%, #ede9fe 60%, #fff 100%)',
              borderLeft: '4px solid #dc2626',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ fontSize: '2rem', lineHeight: 1 }}>🎉</div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#dc2626', letterSpacing: 0.5, textTransform: 'uppercase' }}>Holiday</div>
                  <h2 style={{ margin: '2px 0 4px', fontSize: '1.2rem', color: 'var(--gray-900)' }}>{dateHoliday.title}</h2>
                  <div style={{ fontSize: '0.85rem', color: 'var(--gray-600)' }}>
                    School is closed on {date}. <strong>No attendance to mark today.</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', marginBottom: '1rem' }}>
            <div className="stat-card green">
              <div className="stat-icon green"><FiCheck /></div>
              <div className="stat-info"><span className="label">Present</span><span className="value">{stats.PRESENT}</span></div>
            </div>
            <div className="stat-card rose">
              <div className="stat-icon rose"><FiX /></div>
              <div className="stat-info"><span className="label">Absent</span><span className="value">{stats.ABSENT}</span></div>
            </div>
            <div className="stat-card amber">
              <div className="stat-icon amber"><FiClock /></div>
              <div className="stat-info"><span className="label">Late</span><span className="value">{stats.LATE}</span></div>
            </div>
            <div className="stat-card purple">
              <div className="stat-icon purple"><FiSunrise /></div>
              <div className="stat-info"><span className="label">Half Day</span><span className="value">{stats.HALF_DAY}</span></div>
            </div>
            <div className="stat-card blue">
              <div className="stat-icon blue"><FiUserCheck /></div>
              <div className="stat-info">
                <span className="label">Marked / Total</span>
                <span className="value">{stats.marked} / {stats.total}</span>
              </div>
            </div>
          </div>

          {/* Toolbar */}
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div className="card-body" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button className="btn btn-secondary btn-sm" onClick={markAllPresent} disabled={!!dateHoliday || stats.unmarked === 0} title="Fill unmarked rows as Present">
                  <FiUsers size={13} /> Mark unmarked Present
                </button>
                <button className="btn btn-secondary btn-sm" onClick={copyFromYesterday} disabled={!!dateHoliday} title="Copy attendance from the most recent working day">
                  <FiCopy size={13} /> Copy from last day
                </button>
                <button className="btn btn-secondary btn-sm" onClick={resetUnsaved} disabled={!hasChanges} title="Discard unsaved changes">
                  <FiRotateCcw size={13} /> Reset changes
                </button>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ position: 'relative', width: 240 }}>
                  <FiSearch style={{ position: 'absolute', left: '.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
                  <input type="text" placeholder="Search name / roll…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: '2.2rem', width: '100%' }} />
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={submit}
                  disabled={!!dateHoliday || saving || stats.marked === 0 || !hasChanges}
                  style={{ minWidth: 130 }}
                >
                  <FiSave size={13} /> {saving ? 'Saving…' : hasChanges ? `Save (${stats.marked})` : 'Saved'}
                </button>
              </div>
            </div>
          </div>

          {/* Roster */}
          <div className="card">
            <div className="card-body no-padding">
              {rosterLoading ? (
                <div className="spinner-container"><div className="spinner" /></div>
              ) : roster.length === 0 ? (
                <div className="empty-state">
                  <FiUsers size={32} style={{ color: 'var(--gray-300)' }} />
                  <h3>No students in this section</h3>
                  <p>Ask your admin to enroll students before marking attendance.</p>
                </div>
              ) : filteredRoster.length === 0 ? (
                <div className="empty-state"><h3>No students match your search</h3></div>
              ) : (
                <div className="data-table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: 60 }}>Roll</th>
                        <th>Student</th>
                        <th style={{ width: 380 }}>Status</th>
                        <th>Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRoster.map((s, i) => {
                        const cur = marks[s.student_id];
                        const wasSaved = !!originalMarks[s.student_id];
                        const changed = cur !== originalMarks[s.student_id];
                        return (
                          <tr key={s.student_id} style={{ background: !cur ? 'var(--warning-50, #fffbeb)' : undefined }}>
                            <td style={{ fontWeight: 700, color: 'var(--gray-500)', fontSize: '0.85rem' }}>
                              {s.roll_no || '—'}
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div className="avatar" style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length], width: 32, height: 32, fontSize: '0.75rem' }}>
                                  {getInitials(s.name)}
                                </div>
                                <div>
                                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{s.name}</div>
                                  <div style={{ fontSize: '0.72rem', color: 'var(--gray-400)' }}>
                                    {s.admission_no}
                                    {wasSaved && !changed && (
                                      <span style={{ marginLeft: 6, color: 'var(--success-600)' }}>✓ saved</span>
                                    )}
                                    {changed && (
                                      <span style={{ marginLeft: 6, color: 'var(--primary-600)' }}>● unsaved</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: 4 }}>
                                {STATUSES.map(st => {
                                  const cfg = STATUS_CONFIG[st];
                                  const active = cur === st;
                                  return (
                                    <button
                                      key={st}
                                      onClick={() => setStatus(s.student_id, st)}
                                      title={dateHoliday ? 'Holiday — no attendance to mark' : cfg.label}
                                      disabled={!!dateHoliday}
                                      style={{
                                        flex: 1, minWidth: 70,
                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                                        padding: '6px 8px', borderRadius: 'var(--radius-md)',
                                        border: `1.5px solid ${active ? cfg.color : 'var(--gray-200)'}`,
                                        background: active ? cfg.bg : '#fff',
                                        color: active ? cfg.color : 'var(--gray-500)',
                                        opacity: dateHoliday ? 0.4 : 1,
                                        fontWeight: active ? 700 : 500,
                                        fontSize: '0.78rem',
                                        cursor: dateHoliday ? 'not-allowed' : 'pointer',
                                        transition: 'all 0.15s',
                                      }}
                                    >
                                      {cfg.icon} {cfg.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </td>
                            <td>
                              {editingRemarks === s.student_id ? (
                                <input
                                  autoFocus
                                  type="text"
                                  value={remarks[s.student_id] || ''}
                                  onChange={e => setRemarks(prev => ({ ...prev, [s.student_id]: e.target.value }))}
                                  onBlur={() => setEditingRemarks(null)}
                                  onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingRemarks(null); }}
                                  placeholder="e.g. Doctor visit"
                                  style={{ width: '100%', fontSize: '0.82rem', padding: '4px 8px' }}
                                />
                              ) : (
                                <button
                                  onClick={() => setEditingRemarks(s.student_id)}
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 4,
                                    background: 'transparent', border: 'none', cursor: 'pointer',
                                    color: remarks[s.student_id] ? 'var(--gray-700)' : 'var(--gray-300)',
                                    fontSize: '0.8rem', padding: '4px 6px',
                                  }}
                                >
                                  <FiEdit3 size={11} />
                                  {remarks[s.student_id] || 'Add note'}
                                </button>
                              )}
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
          {hasChanges && (
            <div style={{
              position: 'sticky', bottom: 0, marginTop: 16,
              padding: '12px 18px', background: '#fff',
              border: '1.5px solid var(--primary-200)',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 -4px 16px rgba(0,0,0,0.05)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            }}>
              <span style={{ fontSize: '0.88rem', color: 'var(--gray-700)' }}>
                <strong>{stats.marked}</strong> of <strong>{stats.total}</strong> marked
                {stats.unmarked > 0 && <span style={{ color: 'var(--warning-600, #d97706)' }}> • {stats.unmarked} still unmarked</span>}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={resetUnsaved}>Discard</button>
                <button className="btn btn-primary btn-sm" onClick={submit} disabled={!!dateHoliday || saving || stats.marked === 0}>
                  <FiSave size={13} /> {saving ? 'Saving…' : 'Save attendance'}
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        /* ─── HISTORY TAB ─── */
        <>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button className="btn-icon" onClick={() => navHistMonth(-1)}><FiChevronLeft /></button>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>
                {monthNames[histMonth - 1]} {histYear}
                {activeSection && <span style={{ color: 'var(--gray-400)', fontWeight: 400 }}> · {activeSection.class_name} – {activeSection.section_name}</span>}
              </h3>
              <button className="btn-icon" onClick={() => navHistMonth(1)}><FiChevronRight /></button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: histStudent ? '1fr 360px' : '1fr', gap: '1.25rem' }}>
            <div className="card">
              <div className="card-body no-padding">
                {histLoading ? (
                  <div className="spinner-container"><div className="spinner" /></div>
                ) : !histSummary || histSummary.records?.length === 0 ? (
                  <div className="empty-state">
                    <FiCalendar size={32} style={{ color: 'var(--gray-300)' }} />
                    <h3>No attendance data</h3>
                    <p>No records for this section in {monthNames[histMonth - 1]} {histYear}.</p>
                  </div>
                ) : (
                  <div className="data-table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Student</th>
                          <th>Roll</th>
                          <th>Present</th>
                          <th>Absent</th>
                          <th>Late</th>
                          <th>Half</th>
                          <th>%</th>
                          <th>Calendar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {histSummary.records.map((r: any, i: number) => {
                          const total = (r.PRESENT || 0) + (r.ABSENT || 0) + (r.LATE || 0) + (r.HALF_DAY || 0);
                          const eff = (r.PRESENT || 0) + 0.5 * (r.LATE || 0) + 0.5 * (r.HALF_DAY || 0);
                          const pct = total > 0 ? Math.round((eff / total) * 100) : 0;
                          const active = histStudent?.student_id === r.student_id;
                          return (
                            <tr key={r.student_id} style={{ background: active ? 'var(--primary-50)' : undefined }}>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <div className="avatar" style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length], width: 28, height: 28, fontSize: '0.68rem' }}>
                                    {getInitials(r.name)}
                                  </div>
                                  <div>
                                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{r.name}</div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--gray-400)' }}>{r.admission_no}</div>
                                  </div>
                                </div>
                              </td>
                              <td style={{ fontWeight: 600, color: 'var(--gray-500)', fontSize: '0.82rem' }}>{r.roll_no || '—'}</td>
                              <td><span style={{ color: '#059669', fontWeight: 600 }}>{r.PRESENT || 0}</span></td>
                              <td><span style={{ color: '#e11d48', fontWeight: 600 }}>{r.ABSENT || 0}</span></td>
                              <td><span style={{ color: '#d97706', fontWeight: 600 }}>{r.LATE || 0}</span></td>
                              <td><span style={{ color: '#7c3aed', fontWeight: 600 }}>{r.HALF_DAY || 0}</span></td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 80 }}>
                                  <div style={{ flex: 1, background: 'var(--gray-100)', borderRadius: 4, height: 5 }}>
                                    <div style={{
                                      width: `${pct}%`,
                                      background: pct >= 75 ? 'var(--success-500)' : 'var(--danger-500)',
                                      height: '100%', borderRadius: 4,
                                    }} />
                                  </div>
                                  <span style={{
                                    fontSize: '0.78rem', fontWeight: 700, minWidth: 30,
                                    color: pct >= 75 ? 'var(--success-600)' : 'var(--danger-600)',
                                  }}>{pct}%</span>
                                </div>
                              </td>
                              <td>
                                <button className="btn btn-secondary btn-sm" style={{ padding: '3px 10px', fontSize: '0.75rem' }} onClick={() => active ? setHistStudent(null) : loadStudentCalendar(r)}>
                                  {active ? 'Close' : 'View'}
                                </button>
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

            {histStudent && (
              <div className="card" style={{ alignSelf: 'flex-start', position: 'sticky', top: 80 }}>
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ fontSize: '0.95rem' }}>{histStudent.name}</h3>
                    <p style={{ color: 'var(--gray-400)', fontSize: '0.75rem' }}>Adm: {histStudent.admission_no}</p>
                  </div>
                  <button className="btn-icon" onClick={() => setHistStudent(null)}><FiX size={16} /></button>
                </div>
                <div className="card-body">
                  <div style={{ marginBottom: 10, fontWeight: 600, textAlign: 'center', fontSize: '0.88rem' }}>
                    {monthNames[histMonth - 1]} {histYear}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, textAlign: 'center' }}>
                    {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
                      <div key={d} style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--gray-400)', padding: '2px 0' }}>{d}</div>
                    ))}
                    {Array(getFirstDay(histYear, histMonth)).fill(null).map((_, i) => <div key={`e${i}`} />)}
                    {Array(getDaysInMonth(histYear, histMonth)).fill(null).map((_, i) => {
                      const day = i + 1;
                      const dateStr = `${histYear}-${String(histMonth).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                      const rec = histCalData.find((a: any) => a.date === dateStr);
                      const cfg = rec ? STATUS_CONFIG[rec.status as Status] : null;
                      return (
                        <div key={day} title={rec?.status || ''} style={{
                          width: '100%', aspectRatio: '1', borderRadius: 'var(--radius-sm)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.75rem', fontWeight: cfg ? 700 : 400,
                          background: cfg ? cfg.bg : 'var(--gray-50)',
                          color: cfg ? cfg.color : 'var(--gray-400)',
                        }}>
                          {day}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                    {STATUSES.map(s => {
                      const c = STATUS_CONFIG[s];
                      return (
                        <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <div style={{ width: 10, height: 10, borderRadius: 2, background: c.bg, border: `1px solid ${c.color}40` }} />
                          <span style={{ fontSize: '0.68rem', color: 'var(--gray-500)' }}>{c.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
