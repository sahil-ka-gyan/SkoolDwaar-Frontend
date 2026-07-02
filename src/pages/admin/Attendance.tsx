import React, { useState, useEffect, useMemo } from 'react';
import { FiCheckSquare, FiCalendar, FiSearch, FiX, FiChevronLeft, FiAlertCircle, FiAward, FiDownload, FiPhone } from 'react-icons/fi';
import client from '../../api/client';
import { getInitials } from '../../utils/helpers';

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  PRESENT:  { bg: '#d1fae5', color: '#059669' },
  ABSENT:   { bg: '#ffe4e6', color: '#e11d48' },
  LATE:     { bg: '#fef3c7', color: '#d97706' },
  HALF_DAY: { bg: '#ede9fe', color: '#7c3aed' },
};

const avatarColors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9'];

type Tab = 'classwise' | 'yearly';
type Bucket = 'all' | 'perfect' | 'good' | 'low';

export default function Attendance() {
  const [tab, setTab] = useState<Tab>('classwise');

  // ── Class-wise state ────────────────────────────────────────────────────────
  const [classes, setClasses] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [calData, setCalData] = useState<any[]>([]);
  const [calMonth, setCalMonth] = useState(new Date().getMonth() + 1);
  const [calYear, setCalYear] = useState(new Date().getFullYear());

  // ── Yearly buckets state ────────────────────────────────────────────────────
  const [yearlyData, setYearlyData] = useState<any>(null);
  const [yearlyLoading, setYearlyLoading] = useState(false);
  const [bucket, setBucket] = useState<Bucket>('low');
  const [yClassFilter, setYClassFilter] = useState('');
  const [ySearch, setYSearch] = useState('');
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  useEffect(() => {
    client.get('/classes').then(r => setClasses(r.data || [])).catch(() => {});
  }, []);

  // Class-wise effects
  useEffect(() => {
    if (!classId) { setSections([]); setSectionId(''); return; }
    client.get(`/classes/${classId}/sections`).then(r => setSections(r.data || [])).catch(() => {});
    setSectionId('');
    setSummary(null);
  }, [classId]);

  const loadSummary = async () => {
    if (!sectionId) return;
    setLoading(true);
    const r = await client.get(`/attendance/summary?section_id=${sectionId}`).catch(() => ({ data: null }));
    setSummary(r.data);
    setLoading(false);
  };

  const openStudentDetail = async (student: any) => {
    setSelectedStudent(student);
    await loadCalendar(student.student_id, calYear, calMonth);
  };
  const loadCalendar = async (studentId: string, y: number, m: number) => {
    const r = await client.get(`/attendance/student/${studentId}?year=${y}&month=${m}`).catch(() => ({ data: [] }));
    setCalData(r.data || []);
  };
  const navMonth = async (dir: number) => {
    let m = calMonth + dir, y = calYear;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    setCalMonth(m); setCalYear(y);
    if (selectedStudent) await loadCalendar(selectedStudent.student_id, y, m);
  };
  const getDaysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();
  const getFirstDay = (y: number, m: number) => new Date(y, m - 1, 1).getDay();
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // Yearly load
  useEffect(() => {
    if (tab !== 'yearly') return;
    setYearlyLoading(true);
    client.get('/attendance/yearly-buckets', { params: { year } })
      .then(r => setYearlyData(r.data))
      .catch(() => setYearlyData(null))
      .finally(() => setYearlyLoading(false));
  }, [tab, year]);

  const yearlyRecords = yearlyData?.records || [];
  const yearlyFiltered = useMemo(() => {
    let rows = yearlyRecords;
    if (yClassFilter) rows = rows.filter((r: any) => r.class_name && classes.find((c: any) => c.id === yClassFilter)?.name === r.class_name);
    if (bucket !== 'all') rows = rows.filter((r: any) => r.bucket === bucket);
    if (ySearch.trim()) {
      const q = ySearch.toLowerCase();
      rows = rows.filter((r: any) => `${r.name} ${r.admission_no}`.toLowerCase().includes(q));
    }
    return rows;
  }, [yearlyRecords, yClassFilter, bucket, ySearch, classes]);

  // Recompute counts based on class filter
  const yearlyCounts = useMemo(() => {
    if (!yearlyData) return { perfect: 0, good: 0, low: 0, all: 0 };
    let rows = yearlyRecords;
    if (yClassFilter) rows = rows.filter((r: any) => r.class_name && classes.find((c: any) => c.id === yClassFilter)?.name === r.class_name);
    return {
      perfect: rows.filter((r: any) => r.bucket === 'perfect').length,
      good: rows.filter((r: any) => r.bucket === 'good').length,
      low: rows.filter((r: any) => r.bucket === 'low').length,
      all: rows.length,
    };
  }, [yearlyData, yearlyRecords, yClassFilter, classes]);

  const exportYearlyCSV = () => {
    const rows = [
      ['Name', 'Admission No', 'Class', 'Section', 'Present', 'Absent', 'Late', 'Half Day', 'Total Days', 'Attendance %', 'Bucket', 'Phone'],
      ...yearlyFiltered.map((r: any) => [r.name, r.admission_no, r.class_name || '', r.section_name || '', r.present, r.absent, r.late, r.half_day, r.total_days, r.percentage ?? '', r.bucket, r.phone || '']),
    ];
    const csv = rows.map((r: any[]) => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `attendance-${bucket}-${year}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  const records: any[] = summary?.records || [];
  const filtered = records.filter(r => `${r.name} ${r.admission_no}`.toLowerCase().includes(search.toLowerCase()));
  const totalPresent = records.reduce((s: number, r: any) => s + (r.PRESENT || 0), 0);
  const totalAbsent = records.reduce((s: number, r: any) => s + (r.ABSENT || 0), 0);

  return (
    <div>
      <div className="page-header">
        <h1>Attendance</h1>
        <p style={{ color: 'var(--gray-400)', fontSize: '0.85rem' }}>Track attendance — class-wise or by yearly performance</p>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'classwise' ? 'active' : ''}`} onClick={() => setTab('classwise')}>Class-wise</button>
        <button className={`tab ${tab === 'yearly' ? 'active' : ''}`} onClick={() => setTab('yearly')}>Yearly Buckets</button>
      </div>

      {/* ─── CLASS-WISE TAB ─── */}
      {tab === 'classwise' && (
        <>
          {summary && (
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: '1.25rem' }}>
              <div className="stat-card green"><div className="stat-icon green"><FiCheckSquare /></div><div className="stat-info"><span className="label">Present (total days)</span><span className="value">{totalPresent}</span></div></div>
              <div className="stat-card rose"><div className="stat-icon rose"><FiCheckSquare /></div><div className="stat-info"><span className="label">Absent (total days)</span><span className="value">{totalAbsent}</span></div></div>
              <div className="stat-card blue"><div className="stat-icon blue"><FiCalendar /></div><div className="stat-info"><span className="label">Total Students</span><span className="value">{summary.total_students}</span></div></div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: selectedStudent ? '1fr 360px' : '1fr', gap: '1.25rem' }}>
            <div>
              <div className="card" style={{ marginBottom: '1rem' }}>
                <div style={{ padding: '14px 16px', background: 'var(--gray-50)', borderRadius: 'var(--radius-lg)', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  {/* Class pill */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1.5px solid var(--gray-200)', borderRadius: 'var(--radius-md)', padding: '0 12px', height: 40, flex: 1, minWidth: 160 }}>
                    <FiCalendar size={14} style={{ color: 'var(--primary-500)', flexShrink: 0 }} />
                    <select value={classId} onChange={e => setClassId(e.target.value)}
                      style={{ border: 'none', background: 'transparent', fontWeight: 600, fontSize: '0.88rem', outline: 'none', cursor: 'pointer', color: classId ? 'var(--gray-800)' : 'var(--gray-400)', width: '100%' }}>
                      <option value="">Select class…</option>
                      {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  {/* Section pill */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: classId ? '#fff' : 'var(--gray-100)', border: `1.5px solid ${classId ? 'var(--gray-200)' : 'var(--gray-100)'}`, borderRadius: 'var(--radius-md)', padding: '0 12px', height: 40, flex: 1, minWidth: 140, opacity: classId ? 1 : 0.55 }}>
                    <FiCheckSquare size={14} style={{ color: 'var(--primary-500)', flexShrink: 0 }} />
                    <select value={sectionId} onChange={e => setSectionId(e.target.value)} disabled={!classId}
                      style={{ border: 'none', background: 'transparent', fontWeight: 600, fontSize: '0.88rem', outline: 'none', cursor: classId ? 'pointer' : 'not-allowed', color: sectionId ? 'var(--gray-800)' : 'var(--gray-400)', width: '100%' }}>
                      <option value="">{classId ? 'Select section…' : 'Pick class first'}</option>
                      {sections.map((s: any) => <option key={s.id} value={s.id}>Section {s.name}</option>)}
                    </select>
                  </div>
                  {/* View button */}
                  <button className="btn btn-primary" onClick={loadSummary} disabled={!sectionId || loading}
                    style={{ height: 40, paddingLeft: 20, paddingRight: 20, whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {loading ? 'Loading…' : 'View Attendance'}
                  </button>
                </div>
              </div>

              <div className="card">
                <div className="card-body no-padding">
                  {!summary ? (
                    <div className="empty-state">
                      <FiCheckSquare size={32} style={{ color: 'var(--gray-300)' }} />
                      <h3>Select class & section</h3>
                      <p>Choose a class and section above to view student attendance</p>
                    </div>
                  ) : (
                    <>
                      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gray-100)', background: 'var(--gray-50)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1.5px solid var(--gray-200)', borderRadius: 'var(--radius-md)', padding: '0 12px', height: 38, maxWidth: 340 }}>
                          <FiSearch size={14} style={{ color: 'var(--gray-400)', flexShrink: 0 }} />
                          <input type="text" placeholder="Search by name or admission no..." value={search} onChange={e => setSearch(e.target.value)}
                            style={{ border: 'none', background: 'transparent', fontSize: '0.88rem', outline: 'none', width: '100%' }} />
                          {search && (
                            <button onClick={() => setSearch('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--gray-400)', padding: 0, display: 'flex', alignItems: 'center' }}>
                              <FiX size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                      {filtered.length === 0 ? (
                        <div className="empty-state"><h3>No students in this section</h3></div>
                      ) : (
                        <div className="data-table-wrapper">
                          <table className="data-table">
                            <thead>
                              <tr><th>Student</th><th>Admission No</th><th>Present</th><th>Absent</th><th>Late</th><th>%</th><th>Detail</th></tr>
                            </thead>
                            <tbody>
                              {filtered.map((r: any, i: number) => {
                                const total = (r.PRESENT || 0) + (r.ABSENT || 0) + (r.LATE || 0) + (r.HALF_DAY || 0);
                                const pct = total > 0 ? Math.round((r.PRESENT || 0) / total * 100) : 0;
                                const isSelected = selectedStudent?.student_id === r.student_id;
                                return (
                                  <tr key={r.student_id} style={{ background: isSelected ? 'var(--primary-50)' : undefined }}>
                                    <td>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div className="avatar" style={{ background: avatarColors[i % avatarColors.length], width: 30, height: 30, fontSize: '0.7rem' }}>{getInitials(r.name)}</div>
                                        <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{r.name}</span>
                                      </div>
                                    </td>
                                    <td><span className="badge badge-primary">{r.admission_no}</span></td>
                                    <td><span style={{ color: '#059669', fontWeight: 600 }}>{r.PRESENT || 0}</span></td>
                                    <td><span style={{ color: '#e11d48', fontWeight: 600 }}>{r.ABSENT || 0}</span></td>
                                    <td><span style={{ color: '#d97706', fontWeight: 600 }}>{r.LATE || 0}</span></td>
                                    <td>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 80 }}>
                                        <div style={{ flex: 1, background: 'var(--gray-100)', borderRadius: 4, height: 5 }}>
                                          <div style={{ width: `${pct}%`, background: pct >= 75 ? 'var(--success-500)' : 'var(--danger-500)', height: '100%', borderRadius: 4 }} />
                                        </div>
                                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: pct >= 75 ? 'var(--success-600)' : 'var(--danger-600)', minWidth: 28 }}>{pct}%</span>
                                      </div>
                                    </td>
                                    <td>
                                      <button className="btn btn-secondary btn-sm" style={{ padding: '3px 10px', fontSize: '0.75rem' }} onClick={() => isSelected ? setSelectedStudent(null) : openStudentDetail(r)}>
                                        {isSelected ? 'Close' : 'Calendar'}
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {selectedStudent && (
              <div className="card" style={{ alignSelf: 'flex-start', position: 'sticky', top: 80 }}>
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ fontSize: '0.95rem' }}>{selectedStudent.name}</h3>
                    <p style={{ color: 'var(--gray-400)', fontSize: '0.75rem' }}>Adm: {selectedStudent.admission_no}</p>
                  </div>
                  <button className="btn-icon" onClick={() => setSelectedStudent(null)}><FiX size={16} /></button>
                </div>
                <div className="card-body">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <button className="btn-icon" onClick={() => navMonth(-1)}>‹</button>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{monthNames[calMonth - 1]} {calYear}</span>
                    <button className="btn-icon" onClick={() => navMonth(1)}>›</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, textAlign: 'center' }}>
                    {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
                      <div key={d} style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--gray-400)', padding: '2px 0' }}>{d}</div>
                    ))}
                    {Array(getFirstDay(calYear, calMonth)).fill(null).map((_, i) => <div key={`e${i}`} />)}
                    {Array(getDaysInMonth(calYear, calMonth)).fill(null).map((_, i) => {
                      const day = i + 1;
                      const dateStr = `${calYear}-${String(calMonth).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                      const rec = calData.find((a: any) => a.date === dateStr);
                      const cfg = rec ? STATUS_COLORS[rec.status] : null;
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
                    {Object.entries(STATUS_COLORS).map(([s, c]) => (
                      <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: c.bg, border: `1px solid ${c.color}` }} />
                        <span style={{ fontSize: '0.68rem', color: 'var(--gray-500)' }}>{s.charAt(0) + s.slice(1).toLowerCase().replace('_', ' ')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ─── YEARLY BUCKETS TAB ─── */}
      {tab === 'yearly' && (
        <div>
          {/* Stat cards */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 16 }}>
            <div className="stat-card green">
              <div className="stat-icon green"><FiAward /></div>
              <div className="stat-info">
                <span className="label">Perfect (100%)</span>
                <span className="value">{yearlyCounts.perfect}</span>
              </div>
            </div>
            <div className="stat-card blue">
              <div className="stat-icon blue"><FiCheckSquare /></div>
              <div className="stat-info">
                <span className="label">Good (75–99%)</span>
                <span className="value">{yearlyCounts.good}</span>
              </div>
            </div>
            <div className="stat-card red">
              <div className="stat-icon red"><FiAlertCircle /></div>
              <div className="stat-info">
                <span className="label">Below 75%</span>
                <span className="value">{yearlyCounts.low}</span>
              </div>
            </div>
            <div className="stat-card amber">
              <div className="stat-icon amber"><FiCalendar /></div>
              <div className="stat-info">
                <span className="label">Total Students</span>
                <span className="value">{yearlyCounts.all}</span>
              </div>
            </div>
          </div>

          <div className="card">
            {/* Premium filter bar */}
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--gray-100)', background: 'var(--gray-50)', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              {/* Year pill */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1.5px solid var(--gray-200)', borderRadius: 'var(--radius-md)', padding: '0 10px', height: 38 }}>
                <FiCalendar size={14} style={{ color: 'var(--primary-500)', flexShrink: 0 }} />
                <select value={year} onChange={e => setYear(parseInt(e.target.value))}
                  style={{ border: 'none', background: 'transparent', fontWeight: 700, fontSize: '0.88rem', outline: 'none', cursor: 'pointer', color: 'var(--gray-800)' }}>
                  {[currentYear, currentYear - 1, currentYear - 2].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              {/* Class pill */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1.5px solid var(--gray-200)', borderRadius: 'var(--radius-md)', padding: '0 10px', height: 38 }}>
                <FiCheckSquare size={14} style={{ color: 'var(--primary-500)', flexShrink: 0 }} />
                <select value={yClassFilter} onChange={e => setYClassFilter(e.target.value)}
                  style={{ border: 'none', background: 'transparent', fontWeight: 600, fontSize: '0.88rem', outline: 'none', cursor: 'pointer', color: 'var(--gray-700)', minWidth: 140 }}>
                  <option value="">All Classes</option>
                  {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              {/* Search pill */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1.5px solid var(--gray-200)', borderRadius: 'var(--radius-md)', padding: '0 12px', height: 38, flex: 1, minWidth: 180 }}>
                <FiSearch size={14} style={{ color: 'var(--gray-400)', flexShrink: 0 }} />
                <input type="text" placeholder="Search by name or admission no..." value={ySearch} onChange={e => setYSearch(e.target.value)}
                  style={{ border: 'none', background: 'transparent', fontSize: '0.88rem', outline: 'none', width: '100%', color: 'var(--gray-800)' }} />
                {ySearch && (
                  <button onClick={() => setYSearch('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--gray-400)', padding: 0, display: 'flex', alignItems: 'center' }}>
                    <FiX size={14} />
                  </button>
                )}
              </div>
              {/* Export */}
              <button className="btn btn-secondary btn-sm" onClick={exportYearlyCSV} style={{ height: 38, whiteSpace: 'nowrap' }}>
                <FiDownload size={13} /> Export CSV
              </button>
            </div>

            {/* Sub-tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--gray-100)', padding: '0 16px', gap: 4 }}>
              {([
                { key: 'low', label: 'Below 75%', count: yearlyCounts.low, color: 'var(--danger-600)' },
                { key: 'good', label: '75% – 99%', count: yearlyCounts.good, color: 'var(--primary-600)' },
                { key: 'perfect', label: '100% Perfect', count: yearlyCounts.perfect, color: 'var(--success-600)' },
                { key: 'all', label: 'All', count: yearlyCounts.all, color: 'var(--gray-700)' },
              ] as const).map(st => (
                <button key={st.key} onClick={() => setBucket(st.key)} style={{
                  background: 'transparent', border: 'none', padding: '10px 14px', cursor: 'pointer',
                  fontSize: '0.85rem', fontWeight: 600,
                  color: bucket === st.key ? st.color : 'var(--gray-500)',
                  borderBottom: bucket === st.key ? `2px solid ${st.color}` : '2px solid transparent',
                  marginBottom: -1,
                }}>
                  {st.label} <span style={{ fontSize: '0.72rem', padding: '2px 6px', background: 'var(--gray-100)', borderRadius: 10, marginLeft: 4 }}>{st.count}</span>
                </button>
              ))}
            </div>

            <div className="card-body no-padding">
              {yearlyLoading ? (
                <div className="spinner-container"><div className="spinner" /></div>
              ) : yearlyFiltered.length === 0 ? (
                <div className="empty-state">
                  {bucket === 'perfect' ? <FiAward size={28} style={{ color: 'var(--success-400)' }} /> :
                   bucket === 'low' ? <FiAlertCircle size={28} style={{ color: 'var(--danger-400)' }} /> :
                   <FiCheckSquare size={28} style={{ color: 'var(--gray-300)' }} />}
                  <h3>No students in this bucket</h3>
                  <p>{bucket === 'perfect' ? 'No 100% attendance students yet — set the bar high!' :
                       bucket === 'low' ? 'Great news — no students below 75% attendance.' :
                       bucket === 'good' ? 'No students in the 75–99% range.' :
                       'No attendance data for the selected year.'}</p>
                </div>
              ) : (
                <table className="data-table">
                  <thead><tr><th>Student</th><th>Class</th><th>Present</th><th>Absent</th><th>Late / Half</th><th>Total Days</th><th>%</th><th>Action</th></tr></thead>
                  <tbody>
                    {yearlyFiltered.map((r: any, i: number) => (
                      <tr key={r.student_id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div className="avatar" style={{ background: avatarColors[i % avatarColors.length], width: 30, height: 30, fontSize: '0.7rem' }}>{getInitials(r.name)}</div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{r.name}</div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--gray-400)' }}>{r.admission_no}{r.father_name ? ` • ${r.father_name}` : ''}</div>
                            </div>
                          </div>
                        </td>
                        <td><span className="badge badge-neutral">{r.class_name}{r.section_name ? ` - ${r.section_name}` : ''}</span></td>
                        <td style={{ color: '#059669', fontWeight: 600 }}>{r.present}</td>
                        <td style={{ color: '#e11d48', fontWeight: 600 }}>{r.absent}</td>
                        <td style={{ fontSize: '0.85rem', color: '#d97706' }}>{r.late} / {r.half_day}</td>
                        <td style={{ fontSize: '0.85rem', color: 'var(--gray-500)' }}>{r.total_days}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 96 }}>
                            <div style={{ flex: 1, background: 'var(--gray-100)', borderRadius: 4, height: 6 }}>
                              <div style={{
                                width: `${r.percentage ?? 0}%`,
                                background: r.percentage >= 100 ? 'var(--success-500)' : r.percentage >= 75 ? 'var(--primary-500)' : 'var(--danger-500)',
                                height: '100%', borderRadius: 4,
                              }} />
                            </div>
                            <span style={{ fontSize: '0.82rem', fontWeight: 700, minWidth: 38,
                              color: r.percentage >= 100 ? 'var(--success-600)' : r.percentage >= 75 ? 'var(--primary-600)' : 'var(--danger-600)',
                            }}>{r.percentage !== null ? `${r.percentage}%` : '—'}</span>
                          </div>
                        </td>
                        <td>
                          {r.phone && r.bucket === 'low' && (
                            <a className="btn-icon" title="WhatsApp parent" target="_blank" rel="noreferrer" style={{ color: '#25D366' }}
                               href={`https://wa.me/${r.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hello, ${r.name}'s yearly attendance is ${r.percentage}% — below the required 75%. Please ensure regular attendance.`)}`}>
                              <FiPhone size={14} />
                            </a>
                          )}
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
  );
}
