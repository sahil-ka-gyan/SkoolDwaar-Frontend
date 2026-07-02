import React, { useState, useEffect, useMemo } from 'react';
import {
  FiCalendar, FiClock, FiUser, FiBook, FiCoffee, FiSun, FiActivity, FiAward,
  FiPlay, FiArrowRight, FiUsers,
} from 'react-icons/fi';
import client from '../../api/client';
import { getInitials } from '../../utils/helpers';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const PERIOD_META: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  CLASS:    { icon: FiBook,     color: '#6366f1', bg: '#eef2ff', label: 'Class' },
  LUNCH:    { icon: FiCoffee,   color: '#f59e0b', bg: '#fef3c7', label: 'Lunch' },
  PRAYER:   { icon: FiSun,      color: '#0ea5e9', bg: '#e0f2fe', label: 'Prayer' },
  ASSEMBLY: { icon: FiAward,    color: '#ec4899', bg: '#fce7f3', label: 'Assembly' },
  BREAK:    { icon: FiClock,    color: '#64748b', bg: '#f1f5f9', label: 'Break' },
  SPORTS:   { icon: FiActivity, color: '#10b981', bg: '#d1fae5', label: 'Sports' },
  ACTIVITY: { icon: FiAward,    color: '#8b5cf6', bg: '#ede9fe', label: 'Activity' },
  OTHER:    { icon: FiCalendar, color: '#6b7280', bg: '#f3f4f6', label: 'Other' },
};

type Tab = 'today' | 'tomorrow' | 'week';

interface Child {
  student_id: string;
  first_name: string;
  last_name: string;
  admission_no: string;
  section_id: string | null;
  class_name: string | null;
  section_name: string | null;
}

interface ScheduleItem {
  kind: string;
  id: string;
  day: string;
  start_time: string;
  end_time: string;
  period_type: string;
  title: string;
  subject_name?: string | null;
  teacher_name?: string | null;
  notes?: string | null;
  status?: string;
}

export default function ParentTimetable() {
  const [children, setChildren] = useState<Child[]>([]);
  const [childId, setChildId] = useState<string>('');
  const [tab, setTab] = useState<Tab>('today');
  const [today, setToday] = useState<ScheduleItem[]>([]);
  const [tomorrow, setTomorrow] = useState<ScheduleItem[]>([]);
  const [week, setWeek] = useState<ScheduleItem[]>([]);
  const [todayHoliday, setTodayHoliday] = useState<any>(null);
  const [tomorrowHoliday, setTomorrowHoliday] = useState<any>(null);
  const [weekHolidays, setWeekHolidays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  const [todayName, setTodayName] = useState('');
  const [tomorrowName, setTomorrowName] = useState('');

  // Re-render every 30s for live indicators
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(i);
  }, []);

  // Load children
  useEffect(() => {
    client.get('/parent/children')
      .then(r => {
        const kids: Child[] = Array.isArray(r.data) ? r.data : [];
        setChildren(kids);
        if (kids.length === 1) setChildId(kids[0].student_id);
        else if (kids.length === 0) setError('No children linked to your account yet. Ask your school admin to link your account to your child.');
      })
      .catch(() => setError('Failed to load children.'))
      .finally(() => setLoading(false));
  }, []);

  const activeChild = useMemo(() => children.find(c => c.student_id === childId), [children, childId]);
  const sectionId = activeChild?.section_id;

  // Load schedule when child changes; auto-refresh every 2 min
  const loadAll = async (sid: string | null | undefined) => {
    if (!sid) { setToday([]); setTomorrow([]); setWeek([]); setTodayHoliday(null); setTomorrowHoliday(null); setWeekHolidays([]); return; }
    const [todayR, tomR, weekR] = await Promise.all([
      client.get('/schedule', { params: { section_id: sid, when: 'today' } }).catch(() => ({ data: { items: [] } })),
      client.get('/schedule', { params: { section_id: sid, when: 'tomorrow' } }).catch(() => ({ data: { items: [] } })),
      client.get('/schedule', { params: { section_id: sid } }).catch(() => ({ data: { items: [] } })),
    ]);
    setToday(todayR.data?.items || []);
    setTomorrow(tomR.data?.items || []);
    setWeek(weekR.data?.items || []);
    setTodayHoliday(todayR.data?.holiday || null);
    setTomorrowHoliday(tomR.data?.holiday || null);
    setWeekHolidays(weekR.data?.week_holidays || []);
    setTodayName(todayR.data?.today || new Date().toLocaleDateString('en-US', { weekday: 'long' }));
    setTomorrowName(todayR.data?.tomorrow || '');
  };

  useEffect(() => { loadAll(sectionId); }, [sectionId]);
  useEffect(() => {
    const i = setInterval(() => loadAll(sectionId), 120_000);
    return () => clearInterval(i);
  }, [sectionId]);

  const todayLive = useMemo(() => withLiveStatus(today, now), [today, now]);
  const nowItem = todayLive.find(i => i.status === 'now');
  const nextItem = todayLive.find(i => i.status === 'next');

  if (loading) return <div className="card"><div className="spinner-container"><div className="spinner" /></div></div>;

  if (error) {
    return (
      <div>
        <div className="page-header"><h1>📅 Class Schedule</h1></div>
        <div className="card"><div className="empty-state">
          <FiUsers size={32} style={{ color: 'var(--gray-300)' }} />
          <h3>{error}</h3>
        </div></div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>📅 Class Schedule</h1>
          <p style={{ color: 'var(--gray-400)', fontSize: '0.85rem', margin: '4px 0 0' }}>
            See exactly what your child is doing at school — class, lunch, prayer, sports — live updates.
          </p>
        </div>
      </div>

      {/* Child picker */}
      {children.length > 1 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-body" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {children.map(c => {
              const active = childId === c.student_id;
              return (
                <button key={c.student_id} onClick={() => setChildId(c.student_id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 14px', borderRadius: 'var(--radius-md)',
                    border: `1.5px solid ${active ? 'var(--primary-500)' : 'var(--gray-200)'}`,
                    background: active ? 'var(--primary-50)' : '#fff',
                    color: active ? 'var(--primary-700)' : 'var(--gray-700)',
                    cursor: 'pointer', fontWeight: 600,
                  }}>
                  <div className="avatar" style={{
                    width: 28, height: 28, fontSize: '0.7rem',
                    background: active ? 'var(--primary-500)' : 'var(--gray-300)',
                  }}>{getInitials(`${c.first_name} ${c.last_name}`)}</div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '0.86rem' }}>{c.first_name} {c.last_name}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--gray-400)' }}>
                      {c.class_name ? `${c.class_name}${c.section_name ? ` - ${c.section_name}` : ''}` : 'No section'}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!sectionId ? (
        <div className="card"><div className="empty-state">
          <FiCalendar size={32} style={{ color: 'var(--gray-300)' }} />
          <h3>No section assigned</h3>
          <p>Your child hasn't been placed into a class yet. Contact the school admin.</p>
        </div></div>
      ) : (
        <>
          {/* Child header */}
          {activeChild && (
            <div className="card" style={{ marginBottom: 12, padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="avatar" style={{ width: 42, height: 42, background: '#6366f1' }}>
                  {getInitials(`${activeChild.first_name} ${activeChild.last_name}`)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{activeChild.first_name} {activeChild.last_name}</div>
                  <div style={{ color: 'var(--gray-500)', fontSize: '0.82rem' }}>
                    {activeChild.class_name}{activeChild.section_name ? ` · Section ${activeChild.section_name}` : ''} · Adm: {activeChild.admission_no}
                  </div>
                </div>
              </div>
            </div>
          )}

          {!todayHoliday && <NowHero now={now} nowItem={nowItem} nextItem={nextItem} hasAnyToday={todayLive.length > 0} />}

          <div className="tabs">
            <button className={`tab ${tab === 'today' ? 'active' : ''}`} onClick={() => setTab('today')}>
              Today <span style={{ marginLeft: 4, fontSize: '0.7rem', padding: '2px 6px', background: 'var(--gray-100)', borderRadius: 10 }}>
                {todayHoliday ? '🎉' : today.length}
              </span>
            </button>
            <button className={`tab ${tab === 'tomorrow' ? 'active' : ''}`} onClick={() => setTab('tomorrow')}>
              Tomorrow <span style={{ marginLeft: 4, fontSize: '0.7rem', padding: '2px 6px', background: 'var(--gray-100)', borderRadius: 10 }}>
                {tomorrowHoliday ? '🎉' : tomorrow.length}
              </span>
            </button>
            <button className={`tab ${tab === 'week' ? 'active' : ''}`} onClick={() => setTab('week')}>
              Full Week <span style={{ marginLeft: 4, fontSize: '0.7rem', padding: '2px 6px', background: 'var(--gray-100)', borderRadius: 10 }}>{week.length}</span>
            </button>
          </div>

          {tab === 'today' ? (
            todayHoliday
              ? <HolidayHero label="Today" holiday={todayHoliday} childName={activeChild?.first_name} />
              : <DayList day={todayName} items={todayLive} emptyText="No periods scheduled today." />
          ) : tab === 'tomorrow' ? (
            tomorrowHoliday
              ? <HolidayHero label="Tomorrow" holiday={tomorrowHoliday} childName={activeChild?.first_name} />
              : <DayList day={tomorrowName} items={tomorrow} emptyText="No periods scheduled tomorrow." />
          ) : (
            <WeekView items={week} todayName={todayName} weekHolidays={weekHolidays} />
          )}
        </>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function withLiveStatus(items: ScheduleItem[], now: Date): ScheduleItem[] {
  const today = now.toLocaleDateString('en-US', { weekday: 'long' });
  let nextSet = false;
  return items.map(it => {
    if (it.day !== today) return { ...it, status: 'scheduled' };
    const [sh, sm] = it.start_time.split(':').map(Number);
    const [eh, em] = it.end_time.split(':').map(Number);
    const st = sh * 60 + sm;
    const et = eh * 60 + em;
    const nowMin = now.getHours() * 60 + now.getMinutes();
    if (st <= nowMin && nowMin < et) return { ...it, status: 'now' };
    if (nowMin < st && !nextSet) { nextSet = true; return { ...it, status: 'next' }; }
    if (nowMin < st) return { ...it, status: 'upcoming' };
    return { ...it, status: 'done' };
  });
}

function NowHero({ now, nowItem, nextItem, hasAnyToday }: { now: Date; nowItem?: ScheduleItem; nextItem?: ScheduleItem; hasAnyToday: boolean }) {
  if (!hasAnyToday) return null;
  if (nowItem) {
    const meta = PERIOD_META[nowItem.period_type] || PERIOD_META.OTHER;
    const Icon = meta.icon;
    const [eh, em] = nowItem.end_time.split(':').map(Number);
    const endsAt = new Date(now); endsAt.setHours(eh, em, 0, 0);
    const minsLeft = Math.max(0, Math.round((endsAt.getTime() - now.getTime()) / 60000));
    return (
      <div className="card" style={{
        marginBottom: 12, padding: 18,
        background: `linear-gradient(135deg, ${meta.bg} 0%, #fff 80%)`,
        borderLeft: `4px solid ${meta.color}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: meta.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={22} />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: '0.75rem', color: meta.color, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              <FiPlay style={{ display: 'inline', marginRight: 4 }} /> Your child is in • {meta.label}
            </div>
            <h2 style={{ margin: '2px 0 4px', fontSize: '1.3rem', color: 'var(--gray-900)' }}>{nowItem.title}</h2>
            <div style={{ display: 'flex', gap: 14, color: 'var(--gray-600)', fontSize: '0.85rem', flexWrap: 'wrap' }}>
              <span><FiClock style={{ display: 'inline', marginRight: 4 }} />{nowItem.start_time} – {nowItem.end_time}</span>
              {nowItem.teacher_name && <span><FiUser style={{ display: 'inline', marginRight: 4 }} />{nowItem.teacher_name}</span>}
              {minsLeft > 0 && <span style={{ color: meta.color, fontWeight: 600 }}>Ends in {minsLeft} min</span>}
            </div>
          </div>
          {nextItem && (
            <div style={{ padding: '10px 14px', background: '#fff', borderRadius: 'var(--radius-md)', border: '1px solid var(--gray-200)', minWidth: 180 }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--gray-400)', fontWeight: 600, letterSpacing: 0.4 }}>
                <FiArrowRight style={{ display: 'inline', marginRight: 4 }} /> UP NEXT
              </div>
              <div style={{ fontWeight: 700, fontSize: '0.92rem', marginTop: 2 }}>{nextItem.title}</div>
              <div style={{ color: 'var(--gray-500)', fontSize: '0.78rem' }}>{nextItem.start_time}</div>
            </div>
          )}
        </div>
      </div>
    );
  }
  if (nextItem) {
    const meta = PERIOD_META[nextItem.period_type] || PERIOD_META.OTHER;
    const Icon = meta.icon;
    const [sh, sm] = nextItem.start_time.split(':').map(Number);
    const startAt = new Date(now); startAt.setHours(sh, sm, 0, 0);
    const minsTo = Math.max(0, Math.round((startAt.getTime() - now.getTime()) / 60000));
    return (
      <div className="card" style={{ marginBottom: 12, padding: 16, background: 'linear-gradient(135deg, var(--gray-50) 0%, #fff 100%)', border: '1px dashed var(--gray-200)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: meta.bg, color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--gray-500)', fontWeight: 700, letterSpacing: 0.4 }}>UP NEXT</div>
            <div style={{ fontWeight: 700 }}>{nextItem.title} <span style={{ color: 'var(--gray-400)', fontWeight: 500 }}>· {nextItem.start_time}</span></div>
            {minsTo > 0 && <div style={{ fontSize: '0.78rem', color: meta.color, fontWeight: 600 }}>Starts in {minsTo} min</div>}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="card" style={{ marginBottom: 12, padding: 14, background: '#f9fafb', border: '1px dashed var(--gray-200)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--gray-500)', fontSize: '0.88rem' }}>
        <FiCalendar /> School day is over for today.
      </div>
    </div>
  );
}

function DayList({ day, items, emptyText }: { day: string; items: ScheduleItem[]; emptyText: string }) {
  if (items.length === 0) {
    return (
      <div className="card"><div className="empty-state">
        <FiCalendar size={32} style={{ color: 'var(--gray-300)' }} />
        <h3>{emptyText}</h3>
      </div></div>
    );
  }
  return (
    <div className="card">
      <div className="card-header"><h3 style={{ margin: 0, fontSize: '1rem' }}>{day}</h3></div>
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map(it => <PeriodRow key={it.id} item={it} />)}
      </div>
    </div>
  );
}

function PeriodRow({ item }: { item: ScheduleItem }) {
  const meta = PERIOD_META[item.period_type] || PERIOD_META.OTHER;
  const Icon = meta.icon;
  const isNow = item.status === 'now';
  const isDone = item.status === 'done';
  const isNext = item.status === 'next';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 12px', borderRadius: 'var(--radius-md)',
      background: isNow ? `${meta.color}10` : isDone ? '#fafafa' : '#fff',
      border: `1px solid ${isNow ? meta.color : 'var(--gray-100)'}`,
      borderLeft: `4px solid ${isNow || isNext ? meta.color : meta.color + '60'}`,
      opacity: isDone ? 0.55 : 1,
    }}>
      <div style={{ width: 38, height: 38, borderRadius: 8, background: meta.bg, color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={16} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{item.title}</span>
          {isNow && <span style={{ fontSize: '0.65rem', padding: '2px 7px', borderRadius: 10, background: meta.color, color: '#fff', fontWeight: 700, letterSpacing: 0.4 }}>NOW</span>}
          {isNext && <span style={{ fontSize: '0.65rem', padding: '2px 7px', borderRadius: 10, background: '#fff', color: meta.color, fontWeight: 700, border: `1px solid ${meta.color}` }}>UP NEXT</span>}
          {isDone && <span style={{ fontSize: '0.65rem', padding: '2px 7px', borderRadius: 10, background: 'var(--gray-100)', color: 'var(--gray-500)', fontWeight: 600 }}>Done</span>}
        </div>
        <div style={{ display: 'flex', gap: 12, color: 'var(--gray-500)', fontSize: '0.8rem', marginTop: 2, flexWrap: 'wrap' }}>
          <span><FiClock size={11} style={{ display: 'inline', marginRight: 3 }} />{item.start_time} – {item.end_time}</span>
          {item.teacher_name && <span><FiUser size={11} style={{ display: 'inline', marginRight: 3 }} />{item.teacher_name}</span>}
          {item.notes && <span style={{ fontStyle: 'italic' }}>{item.notes}</span>}
        </div>
      </div>
    </div>
  );
}

function HolidayHero({ label, holiday, childName }: { label: string; holiday: any; childName?: string }) {
  return (
    <div className="card" style={{
      padding: 28, textAlign: 'center',
      background: 'linear-gradient(135deg, #fee2e2 0%, #ede9fe 50%, #e0f2fe 100%)',
      border: '1.5px solid rgba(124, 58, 237, 0.2)',
    }}>
      <div style={{ fontSize: '3.5rem', lineHeight: 1, marginBottom: 8 }}>🎉</div>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: 0.6, color: '#7c3aed', textTransform: 'uppercase' }}>
        {label} · Holiday
      </div>
      <h2 style={{ margin: '6px 0 6px', fontSize: '1.6rem', color: 'var(--gray-900)' }}>{holiday.title}</h2>
      {holiday.is_multi_day && holiday.end_date && (
        <div style={{ fontSize: '0.85rem', color: 'var(--gray-600)' }}>
          {holiday.date} → {holiday.end_date}
        </div>
      )}
      {holiday.description && (
        <p style={{ margin: '10px auto 0', maxWidth: 480, color: 'var(--gray-600)', fontSize: '0.92rem' }}>
          {holiday.description}
        </p>
      )}
      <div style={{ marginTop: 14, color: 'var(--gray-500)', fontSize: '0.85rem' }}>
        {childName ? `${childName} has the day off — no classes.` : 'School is closed — no classes today.'}
      </div>
    </div>
  );
}

function buildHolidayByDay(weekHolidays: any[]): Record<string, any> {
  const map: Record<string, any> = {};
  weekHolidays.forEach(h => {
    (h.covers || []).forEach((c: any) => {
      if (!map[c.day]) map[c.day] = h;
    });
  });
  return map;
}

function WeekView({ items, todayName, weekHolidays }: { items: ScheduleItem[]; todayName: string; weekHolidays: any[] }) {
  const byDay: Record<string, ScheduleItem[]> = {};
  DAYS.forEach(d => byDay[d] = []);
  items.forEach(it => { if (byDay[it.day]) byDay[it.day].push(it); });
  Object.values(byDay).forEach(arr => arr.sort((a, b) => a.start_time.localeCompare(b.start_time)));
  const holidayByDay = buildHolidayByDay(weekHolidays);
  const visibleDays = DAYS.filter(d => byDay[d].length > 0 || holidayByDay[d]);
  if (visibleDays.length === 0) {
    return (
      <div className="card"><div className="empty-state">
        <FiCalendar size={32} style={{ color: 'var(--gray-300)' }} />
        <h3>No periods scheduled for the week</h3>
      </div></div>
    );
  }
  return (
    <div style={{ display: 'grid', gap: '0.85rem' }}>
      {visibleDays.map(day => {
        const isToday = day === todayName;
        const holiday = holidayByDay[day];
        if (holiday) {
          return (
            <div key={day} className="card" style={{
              borderLeft: `6px solid #dc2626`,
              background: 'linear-gradient(135deg, rgba(254, 226, 226, 0.6) 0%, #fff 70%)',
              position: 'relative',
            }}>
              {isToday && (
                <div style={{
                  position: 'absolute', top: -1, right: -1,
                  background: 'var(--primary-500)', color: '#fff',
                  padding: '4px 12px',
                  borderRadius: '0 var(--radius-md) 0 var(--radius-md)',
                  fontSize: '0.68rem', fontWeight: 800, letterSpacing: 0.5,
                }}>● TODAY</div>
              )}
              <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: '1.8rem', lineHeight: 1 }}>🎉</div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', color: '#dc2626' }}>{day}</h3>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--gray-800)' }}>
                    {holiday.title}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--gray-500)' }}>
                    Holiday — no classes
                  </div>
                </div>
              </div>
            </div>
          );
        }
        return (
          <div key={day} className="card" style={{
            borderLeft: `6px solid ${isToday ? 'var(--primary-500)' : 'var(--gray-200)'}`,
            background: isToday
              ? 'linear-gradient(135deg, rgba(99,102,241,0.10) 0%, rgba(99,102,241,0.02) 60%, #fff 100%)'
              : undefined,
            boxShadow: isToday ? '0 4px 14px rgba(99,102,241,0.15)' : undefined,
            position: 'relative',
          }}>
            {isToday && (
              <div style={{
                position: 'absolute', top: -1, right: -1,
                background: 'var(--primary-500)', color: '#fff',
                padding: '4px 12px',
                borderRadius: '0 var(--radius-md) 0 var(--radius-md)',
                fontSize: '0.68rem', fontWeight: 800, letterSpacing: 0.5,
              }}>● TODAY</div>
            )}
            <div className="card-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <h3 style={{
                  margin: 0,
                  fontSize: isToday ? '1.05rem' : '0.95rem',
                  fontWeight: isToday ? 800 : 700,
                  color: isToday ? 'var(--primary-700)' : 'var(--gray-700)',
                }}>{day}</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {byDay[day].map(it => <PeriodRow key={it.id} item={it} />)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
