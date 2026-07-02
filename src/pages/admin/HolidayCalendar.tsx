import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FiChevronLeft, FiChevronRight, FiPlus, FiEdit2, FiTrash2, FiX,
  FiFlag, FiBookOpen, FiSun, FiHome, FiUmbrella, FiCalendar,
  FiCheckCircle, FiAlertCircle, FiClock, FiSave,
} from 'react-icons/fi';
import client from '../../api/client';
import { localISODate, shiftISODate, prettyDate } from './Timetable';

// ── Holiday types — visual identity ─────────────────────────────────────────
export const HOLIDAY_TYPES = [
  { key: 'NATIONAL',  label: 'National',  icon: FiFlag,     color: '#dc2626', bg: '#fee2e2' },
  { key: 'RELIGIOUS', label: 'Religious', icon: FiSun,      color: '#7c3aed', bg: '#ede9fe' },
  { key: 'SCHOOL',    label: 'School',    icon: FiHome,     color: '#0ea5e9', bg: '#e0f2fe' },
  { key: 'EXAM',      label: 'Exam Day',  icon: FiBookOpen, color: '#f59e0b', bg: '#fef3c7' },
  { key: 'VACATION',  label: 'Vacation',  icon: FiUmbrella, color: '#10b981', bg: '#d1fae5' },
  { key: 'OTHER',     label: 'Other',     icon: FiCalendar, color: '#6b7280', bg: '#f3f4f6' },
] as const;
export const HOLIDAY_BY_KEY: Record<string, typeof HOLIDAY_TYPES[number]> = Object.fromEntries(
  HOLIDAY_TYPES.map(t => [t.key, t])
) as any;

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

interface Holiday {
  id: string;
  date: string;       // YYYY-MM-DD
  end_date: string | null;
  title: string;
  description: string | null;
  holiday_type: string;
  color: string | null;
  is_multi_day: boolean;
  days: number;
}

interface Props {
  /** Admin gets full CRUD; everyone else gets read-only. */
  canEdit?: boolean;
  title?: string;
  subtitle?: string;
}

export default function HolidayCalendar({ canEdit = false, title, subtitle }: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1); // 1-12
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [upcoming, setUpcoming] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const emptyForm = {
    id: '',
    date: localISODate(),
    end_date: '',
    title: '',
    description: '',
    holiday_type: 'NATIONAL' as string,
    multi_day: false,
  };
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const showToast = useCallback((kind: 'ok' | 'err', msg: string) => {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 2500);
  }, []);

  // Selected holiday for the detail popover
  const [detail, setDetail] = useState<Holiday | null>(null);

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [yr, up] = await Promise.all([
        client.get('/holidays', { params: { year } }).catch(() => ({ data: [] })),
        client.get('/holidays/upcoming', { params: { limit: 6 } }).catch(() => ({ data: [] })),
      ]);
      setHolidays(yr.data || []);
      setUpcoming(up.data || []);
    } finally {
      setLoading(false);
    }
  }, [year]);
  useEffect(() => { load(); }, [load]);

  // ── Modal helpers ─────────────────────────────────────────────────────────
  const openCreate = (date?: string) => {
    setDetail(null);
    setForm({ ...emptyForm, date: date || localISODate(), end_date: '', multi_day: false });
    setModalOpen(true);
  };
  const openEdit = (h: Holiday) => {
    setDetail(null);
    setForm({
      id: h.id,
      date: h.date,
      end_date: h.end_date || '',
      title: h.title,
      description: h.description || '',
      holiday_type: h.holiday_type,
      multi_day: !!h.end_date && h.end_date !== h.date,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { showToast('err', 'Please enter a title'); return; }
    if (form.multi_day && form.end_date && form.end_date < form.date) {
      showToast('err', 'End date must be on or after start date'); return;
    }
    setSaving(true);
    try {
      const payload: any = {
        date: form.date,
        end_date: form.multi_day && form.end_date ? form.end_date : null,
        title: form.title.trim(),
        description: form.description.trim() || null,
        holiday_type: form.holiday_type,
      };
      if (form.id) {
        if (!form.multi_day) payload.clear_end_date = true;
        await client.patch(`/holidays/${form.id}`, payload);
        showToast('ok', 'Holiday updated');
      } else {
        await client.post('/holidays', payload);
        showToast('ok', 'Holiday added');
      }
      setModalOpen(false);
      await load();
    } catch (e: any) {
      showToast('err', e?.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (h: Holiday) => {
    if (!confirm(`Delete holiday "${h.title}"?`)) return;
    try {
      await client.delete(`/holidays/${h.id}`);
      showToast('ok', 'Holiday deleted');
      setDetail(null);
      await load();
    } catch (e: any) {
      showToast('err', e?.response?.data?.detail || 'Delete failed');
    }
  };

  // ── Date math ─────────────────────────────────────────────────────────────
  // Map every covered date → list of holiday entries (so multi-day spans paint each cell)
  const datesIndex = useMemo(() => {
    const m: Record<string, Holiday[]> = {};
    holidays.forEach(h => {
      const start = new Date(h.date + 'T00:00:00');
      const end = new Date((h.end_date || h.date) + 'T00:00:00');
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = localISODate(d);
        m[key] = m[key] ? [...m[key], h] : [h];
      }
    });
    return m;
  }, [holidays]);

  // Per-month holiday counts for the year strip
  const monthCounts = useMemo(() => {
    const counts = Array(12).fill(0);
    holidays.forEach(h => {
      const start = new Date(h.date + 'T00:00:00');
      const end = new Date((h.end_date || h.date) + 'T00:00:00');
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        if (d.getFullYear() === year) counts[d.getMonth()] += 1;
      }
    });
    return counts;
  }, [holidays, year]);

  const navMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m > 12) { m = 1; y += 1; }
    if (m < 1)  { m = 12; y -= 1; }
    setMonth(m);
    if (y !== year) setYear(y);
  };

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const todayIso = localISODate();
  const thisMonthYear = today.getFullYear() === year && today.getMonth() + 1 === month;
  const totalHolidayDays = Object.keys(datesIndex).filter(d => d.startsWith(`${year}-`)).length;
  const thisMonthDays = monthCounts[month - 1];

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
          display: 'flex', alignItems: 'center', gap: 8, maxWidth: 420,
        }}>
          {toast.kind === 'ok' ? <FiCheckCircle /> : <FiAlertCircle />} {toast.msg}
        </div>
      )}

      <div className="page-header">
        <div>
          <h1>🎉 {title || 'Holiday Calendar'}</h1>
          <p style={{ color: 'var(--gray-400)', fontSize: '0.85rem', margin: '4px 0 0' }}>
            {subtitle || (canEdit
              ? 'Set holidays for your school. Teachers, students and parents see them instantly.'
              : 'Official holidays and school breaks. Plan ahead and never miss a date.')}
          </p>
        </div>
        {canEdit && (
          <button className="btn btn-primary" onClick={() => openCreate()}>
            <FiPlus style={{ marginRight: 6 }} /> Add Holiday
          </button>
        )}
      </div>

      {/* Year + summary header */}
      <div className="card" style={{ marginBottom: '0.75rem' }}>
        <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button className="btn-icon" onClick={() => setYear(year - 1)} title="Previous year"><FiChevronLeft /></button>
          <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--gray-800)' }}>{year}</h2>
          <button className="btn-icon" onClick={() => setYear(year + 1)} title="Next year"><FiChevronRight /></button>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Chip label="Holiday days in year" value={totalHolidayDays} color="#dc2626" bg="#fee2e2" />
            <Chip label={`In ${MONTH_NAMES[month - 1]}`} value={thisMonthDays} color="#0ea5e9" bg="#e0f2fe" />
          </div>
        </div>
      </div>

      {/* Year strip — 12 mini month cards */}
      <div className="card" style={{ marginBottom: '0.75rem' }}>
        <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 8 }}>
          {MONTH_NAMES.map((mn, idx) => {
            const m1 = idx + 1;
            const isCur = m1 === month;
            const isThisMonth = thisMonthYear && m1 === today.getMonth() + 1;
            const count = monthCounts[idx];
            return (
              <button key={mn} onClick={() => setMonth(m1)}
                style={{
                  padding: '8px 10px', borderRadius: 'var(--radius-md)',
                  border: `1.5px solid ${isCur ? 'var(--primary-500)' : 'var(--gray-200)'}`,
                  background: isCur ? 'var(--primary-50)' : isThisMonth ? 'var(--success-50)' : '#fff',
                  color: isCur ? 'var(--primary-700)' : 'var(--gray-700)',
                  cursor: 'pointer', textAlign: 'center',
                  position: 'relative',
                }}>
                <div style={{ fontSize: '0.78rem', fontWeight: isCur ? 800 : 600 }}>{mn.slice(0, 3)}</div>
                {count > 0 && (
                  <div style={{
                    fontSize: '0.66rem', fontWeight: 700, marginTop: 2,
                    color: '#dc2626',
                  }}>{count} {count === 1 ? 'day' : 'days'}</div>
                )}
                {isThisMonth && (
                  <div style={{
                    position: 'absolute', top: 4, right: 4, width: 6, height: 6,
                    background: 'var(--success-500)', borderRadius: '50%',
                  }} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '0.75rem' }} className="hcal-grid">
        {/* Calendar */}
        <div className="card">
          <div className="card-body" style={{ padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <button className="btn-icon" onClick={() => navMonth(-1)}><FiChevronLeft /></button>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--gray-800)' }}>
                {MONTH_NAMES[month - 1]} {year}
              </h3>
              <button className="btn-icon" onClick={() => navMonth(1)}><FiChevronRight /></button>
            </div>

            {/* Weekday header */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 6 }}>
              {WEEKDAYS.map((d, i) => (
                <div key={d} style={{
                  fontSize: '0.7rem', fontWeight: 700, textAlign: 'center',
                  color: i === 0 ? 'var(--danger-500, #ef4444)' : 'var(--gray-500)',
                  letterSpacing: 0.4,
                }}>{d}</div>
              ))}
            </div>

            {/* Day cells */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
              {Array(firstWeekday).fill(null).map((_, i) => <div key={`e${i}`} />)}
              {Array(daysInMonth).fill(null).map((_, i) => {
                const day = i + 1;
                const iso = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                const items = datesIndex[iso] || [];
                const isToday = iso === todayIso;
                const isSunday = new Date(iso + 'T00:00:00').getDay() === 0;
                const primary = items[0];
                const meta = primary ? (HOLIDAY_BY_KEY[primary.holiday_type] || HOLIDAY_BY_KEY.OTHER) : null;
                const bg = meta ? meta.bg : '#fff';
                const fg = meta ? meta.color : (isSunday ? 'var(--danger-500, #ef4444)' : 'var(--gray-700)');
                const Icon = meta?.icon;
                return (
                  <div
                    key={iso}
                    onClick={() => {
                      if (items.length > 0) setDetail(items[0]);
                      else if (canEdit) openCreate(iso);
                    }}
                    style={{
                      minHeight: 72, borderRadius: 'var(--radius-md)',
                      border: `1.5px solid ${isToday ? 'var(--primary-500)' : meta ? meta.color + '40' : 'var(--gray-100)'}`,
                      background: bg,
                      padding: '6px 8px', position: 'relative',
                      cursor: items.length > 0 || canEdit ? 'pointer' : 'default',
                      transition: 'transform 0.1s, box-shadow 0.1s',
                      boxShadow: isToday ? '0 0 0 2px var(--primary-100)' : undefined,
                    }}
                    onMouseEnter={e => { if (items.length > 0 || canEdit) e.currentTarget.style.transform = 'translateY(-1px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
                  >
                    <div style={{
                      fontSize: '0.85rem', fontWeight: isToday ? 800 : 700,
                      color: fg, lineHeight: 1,
                    }}>{day}</div>
                    {meta && Icon && (
                      <div style={{ position: 'absolute', top: 6, right: 6 }}>
                        <Icon size={11} style={{ color: meta.color }} />
                      </div>
                    )}
                    {items.length > 0 && (
                      <div style={{
                        marginTop: 4, fontSize: '0.7rem', fontWeight: 600,
                        color: fg, lineHeight: 1.15, overflow: 'hidden',
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                      }}>{items[0].title}</div>
                    )}
                    {items.length > 1 && (
                      <div style={{
                        position: 'absolute', bottom: 4, right: 6,
                        fontSize: '0.62rem', fontWeight: 700, color: 'var(--gray-500)',
                      }}>+{items.length - 1}</div>
                    )}
                    {isToday && (
                      <div style={{
                        position: 'absolute', bottom: 4, left: 6,
                        background: 'var(--primary-500)', color: '#fff',
                        fontSize: '0.58rem', fontWeight: 700, letterSpacing: 0.4,
                        padding: '1px 5px', borderRadius: 8,
                      }}>TODAY</div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14, paddingTop: 10, borderTop: '1px dashed var(--gray-200)' }}>
              {HOLIDAY_TYPES.map(t => {
                const Icon = t.icon;
                return (
                  <div key={t.key} style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '3px 9px', borderRadius: 'var(--radius-full)',
                    background: t.bg, color: t.color,
                    fontSize: '0.72rem', fontWeight: 600,
                  }}>
                    <Icon size={11} /> {t.label}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Upcoming holidays sidebar */}
        <div>
          <div className="card" style={{ marginBottom: '0.75rem' }}>
            <div className="card-header"><h3 style={{ margin: 0, fontSize: '0.95rem' }}>📌 Upcoming</h3></div>
            <div className="card-body" style={{ padding: 0 }}>
              {loading ? (
                <div className="spinner-container"><div className="spinner" /></div>
              ) : upcoming.length === 0 ? (
                <div className="empty-state" style={{ padding: 18 }}>
                  <FiCalendar size={26} style={{ color: 'var(--gray-300)' }} />
                  <p style={{ fontSize: '0.82rem', color: 'var(--gray-500)' }}>No upcoming holidays</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {upcoming.map(h => <UpcomingRow key={h.id} h={h} onClick={() => setDetail(h)} />)}
                </div>
              )}
            </div>
          </div>

          {/* Detail popover */}
          {detail && (
            <div className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Holiday details</h3>
                <button className="btn-icon" onClick={() => setDetail(null)}><FiX size={14} /></button>
              </div>
              <div className="card-body">
                <DetailCard h={detail} onEdit={canEdit ? () => openEdit(detail) : undefined} onDelete={canEdit ? () => handleDelete(detail) : undefined} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{form.id ? 'Edit Holiday' : 'Add Holiday'}</h3>
              <button className="modal-close" onClick={() => setModalOpen(false)}><FiX /></button>
            </div>
            <div className="modal-body" style={{ display: 'grid', gap: '0.9rem' }}>
              {/* Type chip */}
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--gray-600)', display: 'block', marginBottom: 6 }}>Type</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {HOLIDAY_TYPES.map(t => {
                    const Icon = t.icon;
                    const active = form.holiday_type === t.key;
                    return (
                      <button key={t.key} type="button"
                        onClick={() => setForm(f => ({ ...f, holiday_type: t.key }))}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '6px 12px', borderRadius: 'var(--radius-full)',
                          border: `1.5px solid ${active ? t.color : 'var(--gray-200)'}`,
                          background: active ? t.bg : '#fff',
                          color: active ? t.color : 'var(--gray-500)',
                          fontWeight: active ? 700 : 500, fontSize: '0.82rem', cursor: 'pointer',
                        }}>
                        <Icon size={13} /> {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="form-group">
                <label>Title</label>
                <input className="form-input" placeholder="e.g. Republic Day" value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>

              {/* Single vs multi-day toggle */}
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--gray-600)', display: 'block', marginBottom: 6 }}>Length</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {([
                    { key: false, label: 'Single day' },
                    { key: true,  label: 'Multi-day span' },
                  ] as const).map(o => {
                    const active = form.multi_day === o.key;
                    return (
                      <button key={String(o.key)} type="button"
                        onClick={() => setForm(f => ({ ...f, multi_day: o.key, end_date: o.key && !f.end_date ? shiftISODate(f.date, 1) : f.end_date }))}
                        style={{
                          flex: 1, padding: '8px 12px', borderRadius: 'var(--radius-md)',
                          border: `1.5px solid ${active ? 'var(--primary-500)' : 'var(--gray-200)'}`,
                          background: active ? 'var(--primary-50)' : '#fff',
                          color: active ? 'var(--primary-700)' : 'var(--gray-600)',
                          fontWeight: active ? 700 : 500, fontSize: '0.85rem', cursor: 'pointer',
                        }}>{o.label}</button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: form.multi_day ? '1fr 1fr' : '1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label>{form.multi_day ? 'From' : 'Date'}</label>
                  <input type="date" className="form-input" value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                {form.multi_day && (
                  <div className="form-group">
                    <label>To</label>
                    <input type="date" className="form-input" value={form.end_date}
                      min={form.date}
                      onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>Description (optional)</label>
                <textarea className="form-input" rows={2} placeholder="e.g. National holiday — school closed"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                <FiSave size={13} /> {saving ? 'Saving…' : (form.id ? 'Save Changes' : 'Add Holiday')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Responsive: single column on small screens */}
      <style>{`
        @media (max-width: 900px) {
          .hcal-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function Chip({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 14px', borderRadius: 'var(--radius-full)', background: bg,
    }}>
      <span style={{ fontSize: '0.78rem', color, fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: '0.95rem', color, fontWeight: 800 }}>{value}</span>
    </div>
  );
}

function UpcomingRow({ h, onClick }: { h: Holiday; onClick: () => void }) {
  const meta = HOLIDAY_BY_KEY[h.holiday_type] || HOLIDAY_BY_KEY.OTHER;
  const Icon = meta.icon;
  const start = new Date(h.date + 'T00:00:00');
  const today = new Date(); today.setHours(0,0,0,0);
  const daysAway = Math.round((start.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  const subLabel =
    daysAway === 0 ? 'Today' :
    daysAway === 1 ? 'Tomorrow' :
    daysAway > 0 ? `In ${daysAway} days` :
    'Ongoing';
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 14px', borderBottom: '1px solid var(--gray-100)',
      background: 'transparent', border: 'none', textAlign: 'left',
      cursor: 'pointer', width: '100%',
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 8,
        background: meta.bg, color: meta.color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={16} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '0.88rem', lineHeight: 1.2 }}>{h.title}</div>
        <div style={{ fontSize: '0.74rem', color: 'var(--gray-500)', marginTop: 2 }}>
          {prettyDate(h.date)}{h.is_multi_day && h.end_date ? ` → ${prettyDate(h.end_date)}` : ''} · {subLabel}
        </div>
      </div>
      <FiChevronRight size={14} style={{ color: 'var(--gray-400)' }} />
    </button>
  );
}

function DetailCard({ h, onEdit, onDelete }: { h: Holiday; onEdit?: () => void; onDelete?: () => void }) {
  const meta = HOLIDAY_BY_KEY[h.holiday_type] || HOLIDAY_BY_KEY.OTHER;
  const Icon = meta.icon;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 44, height: 44, borderRadius: '50%',
          background: meta.color, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><Icon size={18} /></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: '1rem', lineHeight: 1.2 }}>{h.title}</div>
          <div style={{ fontSize: '0.74rem', color: meta.color, fontWeight: 600, marginTop: 2 }}>{meta.label}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--gray-600)', fontSize: '0.85rem', marginBottom: 6 }}>
        <FiClock size={12} />
        {h.is_multi_day && h.end_date
          ? <>{prettyDate(h.date)} — {prettyDate(h.end_date)} <span style={{ marginLeft: 4, color: 'var(--gray-400)' }}>({h.days} days)</span></>
          : prettyDate(h.date)}
      </div>
      {h.description && (
        <div style={{ fontSize: '0.85rem', color: 'var(--gray-600)', marginTop: 8, padding: '8px 10px', background: 'var(--gray-50)', borderRadius: 'var(--radius-sm)' }}>
          {h.description}
        </div>
      )}
      {(onEdit || onDelete) && (
        <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
          {onEdit && (
            <button className="btn btn-secondary btn-sm" onClick={onEdit} style={{ flex: 1 }}>
              <FiEdit2 size={12} /> Edit
            </button>
          )}
          {onDelete && (
            <button className="btn btn-secondary btn-sm" onClick={onDelete} style={{ flex: 1, color: 'var(--danger-500)' }}>
              <FiTrash2 size={12} /> Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
