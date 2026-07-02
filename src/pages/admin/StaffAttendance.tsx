import React, { useState, useEffect, useMemo } from 'react';
import { FiSearch, FiCheck, FiX, FiMinus, FiCalendar, FiUserCheck, FiTruck, FiUser, FiUsers } from 'react-icons/fi';
import client from '../../api/client';
import { getInitials } from '../../utils/helpers';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactElement }> = {
  PRESENT:  { label: 'Present',  color: '#059669', bg: '#d1fae5', icon: <FiCheck size={12} /> },
  ABSENT:   { label: 'Absent',   color: '#e11d48', bg: '#ffe4e6', icon: <FiX size={12} /> },
  HALF_DAY: { label: 'Half Day', color: '#d97706', bg: '#fef3c7', icon: <FiMinus size={12} /> },
  LEAVE:    { label: 'Leave',    color: '#7c3aed', bg: '#ede9fe', icon: <FiCalendar size={12} /> },
};

type Tab = 'teachers' | 'drivers';

export default function StaffAttendance() {
  const [tab, setTab] = useState<Tab>('teachers');
  const [teachers, setTeachers] = useState<any[]>([]);
  const [buses, setBuses] = useState<any[]>([]);
  const [teacherAttendance, setTeacherAttendance] = useState<Record<string, string>>({});
  const [driverAttendance, setDriverAttendance] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState<string | null>(null);

  // Calendar
  const [calSubject, setCalSubject] = useState<{ kind: 'TEACHER' | 'DRIVER'; row: any } | null>(null);
  const [calMonth, setCalMonth] = useState(new Date().getMonth() + 1);
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calData, setCalData] = useState<any[]>([]);

  // Toast + holiday for selected date
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const showToast = (kind: 'ok' | 'err', msg: string) => {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 2500);
  };
  const [dateHoliday, setDateHoliday] = useState<any>(null);
  useEffect(() => {
    if (!date) { setDateHoliday(null); return; }
    client.get(`/holidays/on/${date}`)
      .then(r => setDateHoliday(r.data || null))
      .catch(() => setDateHoliday(null));
  }, [date]);

  useEffect(() => { fetchAll(); }, []);
  useEffect(() => { if (teachers.length || buses.length) fetchTodayAttendance(); }, [date, teachers, buses]);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([
      client.get('/staff').then(r => setTeachers(r.data || [])).catch(() => {}),
      client.get('/transport/buses').then(r => setBuses(r.data || [])).catch(() => {}),
    ]);
    setLoading(false);
  };

  const fetchTodayAttendance = async () => {
    const r = await client.get(`/staff-attendance?from_date=${date}&to_date=${date}`).catch(() => ({ data: [] }));
    const tMap: Record<string, string> = {};
    const dMap: Record<string, string> = {};
    (r.data || []).forEach((a: any) => {
      if (a.teacher_id) tMap[a.teacher_id] = a.status;
      else if (a.bus_id) dMap[a.bus_id] = a.status;
    });
    setTeacherAttendance(tMap);
    setDriverAttendance(dMap);
  };

  const markAttendance = async (kind: 'TEACHER' | 'DRIVER', id: string, status: string) => {
    if (dateHoliday) {
      showToast('err', `Cannot mark — ${date} is a holiday (${dateHoliday.title})`);
      return;
    }
    setSaving(id);
    try {
      const payload: any = { date, status };
      if (kind === 'TEACHER') payload.teacher_id = id;
      else payload.bus_id = id;
      await client.post('/staff-attendance', payload);
      if (kind === 'TEACHER') setTeacherAttendance(p => ({ ...p, [id]: status }));
      else setDriverAttendance(p => ({ ...p, [id]: status }));
      // If the calendar panel is open for this same person, refresh it immediately
      if (calSubject && calSubject.kind === kind && calSubject.row.id === id) {
        await fetchCalData(kind, id, calYear, calMonth);
      }
      showToast('ok', 'Saved');
    } catch (e: any) {
      const d = e?.response?.data?.detail;
      showToast('err', typeof d === 'string' ? d : (d?.message || 'Failed to save'));
    }
    setSaving(null);
  };

  const lastDay = (year: number, month: number) => String(new Date(year, month, 0).getDate()).padStart(2, '0');

  const fetchCalData = async (kind: 'TEACHER' | 'DRIVER', id: string, year: number, month: number) => {
    const mm = String(month).padStart(2, '0');
    const param = kind === 'TEACHER' ? `teacher_id=${id}` : `bus_id=${id}`;
    const r = await client.get(`/staff-attendance?${param}&from_date=${year}-${mm}-01&to_date=${year}-${mm}-${lastDay(year, month)}`).catch(() => ({ data: [] }));
    setCalData(r.data || []);
  };

  const openCalendar = async (kind: 'TEACHER' | 'DRIVER', row: any) => {
    // Clear stale data immediately so previous person's calendar doesn't flash
    setCalData([]);
    setCalSubject({ kind, row });
    await fetchCalData(kind, row.id, calYear, calMonth);
  };

  const navMonth = async (dir: number) => {
    let m = calMonth + dir, y = calYear;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    setCalMonth(m); setCalYear(y);
    if (calSubject) await fetchCalData(calSubject.kind, calSubject.row.id, y, m);
  };

  const getDaysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();
  const getFirstDay = (year: number, month: number) => new Date(year, month - 1, 1).getDay();
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // Filtered lists
  const filteredTeachers = useMemo(() => teachers.filter(t =>
    `${t.first_name || ''} ${t.last_name || ''} ${t.employee_id || ''} ${t.department || ''}`.toLowerCase().includes(search.toLowerCase())
  ), [teachers, search]);
  const filteredDrivers = useMemo(() => buses.filter(b =>
    `${b.driver_name || ''} ${b.bus_number || ''} ${b.driver_phone || ''}`.toLowerCase().includes(search.toLowerCase())
  ), [buses, search]);

  // Per-tab summary chips
  const currentAttendance = tab === 'teachers' ? teacherAttendance : driverAttendance;
  const currentTotal = tab === 'teachers' ? teachers.length : buses.length;
  const colors = ['#10b981', '#6366f1', '#f59e0b', '#0ea5e9', '#8b5cf6', '#ef4444'];

  const renderRow = (kind: 'TEACHER' | 'DRIVER', row: any, idx: number) => {
    const id = row.id;
    const status = kind === 'TEACHER' ? teacherAttendance[id] : driverAttendance[id];
    const cfg = status ? STATUS_CONFIG[status] : null;
    const name = kind === 'TEACHER' ? `${row.first_name || ''} ${row.last_name || ''}` : row.driver_name;
    const subtitle = kind === 'TEACHER' ? row.employee_id : `Bus ${row.bus_number}`;
    const deptOrPhone = kind === 'TEACHER' ? (row.department || '—') : (row.driver_phone || '—');
    return (
      <tr key={id}>
        <td>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {kind === 'DRIVER' ? (
              <div className="avatar" style={{ background: '#7c3aed' }}><FiTruck size={14} /></div>
            ) : (
              <div className="avatar" style={{ background: colors[idx % colors.length] }}>{getInitials(name)}</div>
            )}
            <div>
              <div style={{ fontWeight: 600 }}>{name}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--gray-400)' }}>{subtitle}</div>
            </div>
          </div>
        </td>
        <td style={{ color: 'var(--gray-500)', fontSize: '0.85rem' }}>{deptOrPhone}</td>
        <td>
          {cfg ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 'var(--radius-full)', background: cfg.bg, color: cfg.color, fontSize: '0.78rem', fontWeight: 600 }}>
              {cfg.icon} {cfg.label}
            </span>
          ) : (
            <span style={{ color: 'var(--gray-300)', fontSize: '0.8rem' }}>Not marked</span>
          )}
        </td>
        <td>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {Object.entries(STATUS_CONFIG).map(([s, c]) => (
              <button
                key={s} disabled={!!dateHoliday || saving === id} onClick={() => markAttendance(kind, id, s)}
                title={dateHoliday ? `Holiday — ${dateHoliday.title}` : c.label}
                style={{
                  padding: '4px 10px', borderRadius: 'var(--radius-full)', fontSize: '0.75rem', fontWeight: 500,
                  border: `1.5px solid ${status === s ? c.color : 'var(--gray-200)'}`,
                  background: status === s ? c.bg : '#fff',
                  color: status === s ? c.color : 'var(--gray-500)',
                  cursor: dateHoliday ? 'not-allowed' : 'pointer',
                  opacity: dateHoliday ? 0.45 : 1,
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
        </td>
        <td>
          <button className="btn btn-secondary btn-sm" style={{ width: 'auto', fontSize: '0.75rem', padding: '4px 10px' }} onClick={() => openCalendar(kind, row)}>
            <FiCalendar size={12} /> View
          </button>
        </td>
      </tr>
    );
  };

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 1100,
          padding: '12px 18px', borderRadius: 'var(--radius-md)',
          background: toast.kind === 'ok' ? 'var(--success-600, #059669)' : 'var(--danger-600, #dc2626)',
          color: '#fff', fontSize: '0.88rem', fontWeight: 600,
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          maxWidth: 420,
        }}>{toast.msg}</div>
      )}

      <div className="page-header">
        <h1>Staff Attendance</h1>
        <div className="actions">
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--gray-200)', fontSize: '0.88rem' }} />
        </div>
      </div>

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
                School is closed on {date}. <strong>No staff or driver attendance to mark today.</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${tab === 'teachers' ? 'active' : ''}`} onClick={() => {
          setTab('teachers');
          setSearch('');
          // Close calendar if it was showing a driver (cross-type mismatch)
          if (calSubject?.kind === 'DRIVER') { setCalSubject(null); setCalData([]); }
        }}>
          👩‍🏫 Teachers <span style={{ marginLeft: 4, fontSize: '0.72rem', padding: '2px 6px', background: 'var(--gray-100)', borderRadius: 10 }}>{teachers.length}</span>
        </button>
        <button className={`tab ${tab === 'drivers' ? 'active' : ''}`} onClick={() => {
          setTab('drivers');
          setSearch('');
          // Close calendar if it was showing a teacher (cross-type mismatch)
          if (calSubject?.kind === 'TEACHER') { setCalSubject(null); setCalData([]); }
        }}>
          🚌 Drivers <span style={{ marginLeft: 4, fontSize: '0.72rem', padding: '2px 6px', background: 'var(--gray-100)', borderRadius: 10 }}>{buses.length}</span>
        </button>
      </div>

      {/* Summary chips */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {Object.entries(STATUS_CONFIG).map(([status, cfg]) => {
          const count = Object.values(currentAttendance).filter(v => v === status).length;
          return (
            <div key={status} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 'var(--radius-full)',
              background: cfg.bg, border: `1px solid ${cfg.color}30`,
            }}>
              <span style={{ color: cfg.color }}>{cfg.icon}</span>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: cfg.color }}>{count}</span>
            </div>
          );
        })}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 'var(--radius-full)', background: 'var(--gray-100)' }}>
          <FiUserCheck size={13} style={{ color: 'var(--gray-500)' }} />
          <span style={{ fontSize: '0.82rem', color: 'var(--gray-500)' }}>Not marked</span>
          <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--gray-600)' }}>
            {currentTotal - Object.keys(currentAttendance).length}
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: calSubject ? '1fr 380px' : '1fr', gap: '1.25rem' }}>
        <div className="card">
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gray-100)', background: 'var(--gray-50)', display: 'flex', gap: 10, alignItems: 'center' }}>
            {/* Search pill */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1.5px solid var(--gray-200)', borderRadius: 'var(--radius-md)', padding: '0 12px', height: 38, flex: 1, maxWidth: 360 }}>
              <FiSearch size={14} style={{ color: 'var(--gray-400)', flexShrink: 0 }} />
              <input
                type="text"
                placeholder={tab === 'teachers' ? 'Search by name, employee ID, department…' : 'Search by driver name, bus number, phone…'}
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ border: 'none', background: 'transparent', fontSize: '0.88rem', outline: 'none', width: '100%', color: 'var(--gray-800)' }}
              />
              {search && (
                <button onClick={() => setSearch('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--gray-400)', padding: 0, display: 'flex', alignItems: 'center' }}>
                  <FiX size={13} />
                </button>
              )}
            </div>
            {/* Count chip */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0 12px', height: 38, background: '#fff', border: '1.5px solid var(--gray-200)', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', color: 'var(--gray-600)', fontWeight: 600, flexShrink: 0 }}>
              <FiUsers size={13} style={{ color: 'var(--primary-500)' }} />
              {tab === 'teachers' ? filteredTeachers.length : filteredDrivers.length}
              &nbsp;{tab === 'teachers' ? 'teacher' : 'driver'}{(tab === 'teachers' ? filteredTeachers.length : filteredDrivers.length) !== 1 ? 's' : ''}
            </div>
          </div>
          <div className="card-body no-padding">
            {loading ? (
              <div className="spinner-container"><div className="spinner" /></div>
            ) : (tab === 'teachers' ? filteredTeachers : filteredDrivers).length === 0 ? (
              <div className="empty-state">
                {tab === 'teachers' ? <FiUser size={32} style={{ color: 'var(--gray-300)' }} /> : <FiTruck size={32} style={{ color: 'var(--gray-300)' }} />}
                <h3>No {tab === 'teachers' ? 'teachers' : 'drivers'} found</h3>
              </div>
            ) : (
              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{tab === 'teachers' ? 'Teacher' : 'Driver'}</th>
                      <th>{tab === 'teachers' ? 'Department' : 'Phone'}</th>
                      <th>Status</th>
                      <th>Mark Attendance</th>
                      <th>History</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tab === 'teachers'
                      ? filteredTeachers.map((t, i) => renderRow('TEACHER', t, i))
                      : filteredDrivers.map((b, i) => renderRow('DRIVER', b, i))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Calendar panel */}
        {calSubject && (
          <div className="card" style={{ alignSelf: 'flex-start', position: 'sticky', top: 80 }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '0.95rem' }}>
                  {calSubject.kind === 'TEACHER'
                    ? `${calSubject.row.first_name} ${calSubject.row.last_name}`
                    : calSubject.row.driver_name}
                </h3>
                <p style={{ color: 'var(--gray-400)', fontSize: '0.78rem' }}>
                  {calSubject.kind === 'TEACHER' ? calSubject.row.employee_id : `Bus ${calSubject.row.bus_number}`}
                </p>
              </div>
              <button className="btn-icon" onClick={() => setCalSubject(null)}><FiX size={16} /></button>
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <button className="btn-icon" onClick={() => navMonth(-1)}>‹</button>
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{monthNames[calMonth - 1]} {calYear}</span>
                <button className="btn-icon" onClick={() => navMonth(1)}>›</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, textAlign: 'center' }}>
                {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
                  <div key={d} style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--gray-400)', padding: '2px 0' }}>{d}</div>
                ))}
                {Array(getFirstDay(calYear, calMonth)).fill(null).map((_, i) => <div key={`e${i}`} />)}
                {Array(getDaysInMonth(calYear, calMonth)).fill(null).map((_, i) => {
                  const day = i + 1;
                  const dateStr = `${calYear}-${String(calMonth).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                  const rec = calData.find((a: any) => a.date === dateStr);
                  const cfg = rec ? STATUS_CONFIG[rec.status] : null;
                  return (
                    <div key={day} style={{
                      width: '100%', aspectRatio: '1', borderRadius: 'var(--radius-sm)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.78rem', fontWeight: cfg ? 700 : 400,
                      background: cfg ? cfg.bg : 'var(--gray-50)',
                      color: cfg ? cfg.color : 'var(--gray-500)',
                      border: `1px solid ${cfg ? cfg.color + '40' : 'transparent'}`,
                    }}>
                      {day}
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: 12 }}>
                {Object.entries(STATUS_CONFIG).map(([s, c]) => (
                  <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: c.bg, border: `1px solid ${c.color}60` }} />
                    <span style={{ fontSize: '0.7rem', color: 'var(--gray-500)' }}>{c.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
