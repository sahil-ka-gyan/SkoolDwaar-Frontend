import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FiCalendar, FiPlus, FiTrash2, FiX, FiEdit2, FiBook, FiCoffee, FiSun,
  FiActivity, FiAward, FiClock, FiUser, FiPlay, FiCheckCircle, FiAlertCircle,
  FiSave, FiChevronLeft, FiChevronRight,
} from 'react-icons/fi';
import client from '../../api/client';

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
// Allowed day options in pickers — Sunday explicitly excluded by product decision
export const DAY_OPTIONS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Helpers
export const dayName = (isoDate: string) =>
  new Date(isoDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });
export const addMinutes = (hhmm: string, mins: number) => {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + mins;
  const H = String(Math.floor(total / 60) % 24).padStart(2, '0');
  const M = String(total % 60).padStart(2, '0');
  return `${H}:${M}`;
};
export const prettyDate = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

// Format a JS Date as YYYY-MM-DD using *local* fields (NOT toISOString which is UTC and
// silently shifts the date in timezones east of UTC).
export const localISODate = (d: Date = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
// Add `delta` days to a "YYYY-MM-DD" string and return a "YYYY-MM-DD" string (local time).
export const shiftISODate = (iso: string, delta: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  return localISODate(new Date(y, m - 1, d + delta));
};

export const PERIOD_TYPES = [
  { key: 'CLASS',    label: 'Class',     icon: FiBook,     color: '#6366f1', bg: '#eef2ff' },
  { key: 'LUNCH',    label: 'Lunch',     icon: FiCoffee,   color: '#f59e0b', bg: '#fef3c7' },
  { key: 'PRAYER',   label: 'Prayer',    icon: FiSun,      color: '#0ea5e9', bg: '#e0f2fe' },
  { key: 'ASSEMBLY', label: 'Assembly',  icon: FiAward,    color: '#ec4899', bg: '#fce7f3' },
  { key: 'BREAK',    label: 'Break',     icon: FiClock,    color: '#64748b', bg: '#f1f5f9' },
  { key: 'SPORTS',   label: 'Sports',    icon: FiActivity, color: '#10b981', bg: '#d1fae5' },
  { key: 'ACTIVITY', label: 'Activity',  icon: FiAward,    color: '#8b5cf6', bg: '#ede9fe' },
  { key: 'OTHER',    label: 'Other',     icon: FiCalendar, color: '#6b7280', bg: '#f3f4f6' },
] as const;
export type PeriodKey = typeof PERIOD_TYPES[number]['key'];
export const PERIOD_BY_KEY: Record<string, typeof PERIOD_TYPES[number]> = Object.fromEntries(
  PERIOD_TYPES.map(p => [p.key, p])
) as any;

interface ScheduleItem {
  kind: 'CLASS' | 'PERIOD';
  id: string;
  section_id: string;
  day: string;
  start_time: string;
  end_time: string;
  period_type: string;
  title: string;
  subject_id?: string | null;
  subject_name?: string | null;
  teacher_id?: string | null;
  teacher_name?: string | null;
  color?: string | null;
  notes?: string | null;
  valid_from?: string | null;
  valid_until?: string | null;
  specific_date?: string | null;
  is_one_off?: boolean;
  status?: 'now' | 'next' | 'upcoming' | 'done' | 'scheduled';
}

interface Props {
  /** Pass a fixed sections list (e.g. teacher's class-teacher sections) — when omitted
   *  the page loads all sections in the school (admin mode). */
  sectionsOverride?: { id: string; label: string; class_id?: string }[];
  /** Allow the user to pick from the section list. Default true. */
  showSectionPicker?: boolean;
  /** Heading override. */
  title?: string;
  /** Subtitle override. */
  subtitle?: string;
  /** Restrict allowed period types in the editor. Default: all 8. Teachers pass non-CLASS types only. */
  allowedTypes?: string[];
  /** Hide edit/delete actions on slots not allowed by allowedTypes. Default: false. */
  readOnlyDisallowed?: boolean;
  /** Full view-only mode — no add/edit/delete buttons, no quick-add bar, no timing edit.
   *  Used for teacher / student / parent. */
  viewOnly?: boolean;
}

export function TimetableManager({ sectionsOverride, showSectionPicker = true, title, subtitle, allowedTypes, readOnlyDisallowed, viewOnly }: Props) {
  const enabledTypes = useMemo(() => allowedTypes || PERIOD_TYPES.map(p => p.key), [allowedTypes]);
  const allowClass = enabledTypes.includes('CLASS');
  const [sections, setSections] = useState<{ id: string; label: string; class_id?: string }[]>([]);
  const [sectionId, setSectionId] = useState('');
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Picklists for CLASS slots
  const [subjects, setSubjects] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);

  // Tab state — Weekly recurring view vs. By-Date one-off view
  const [tab, setTab] = useState<'weekly' | 'bydate'>('weekly');
  const [byDate, setByDate] = useState<string>(localISODate());
  const [byDateItems, setByDateItems] = useState<ScheduleItem[]>([]);
  const [byDateLoading, setByDateLoading] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const showToast = useCallback((kind: 'ok' | 'err', msg: string) => {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 2500);
  }, []);

  // School day timing
  const [timing, setTiming] = useState<{ day_start_time: string | null; day_end_time: string | null; season_label: string | null }>({
    day_start_time: null, day_end_time: null, season_label: null,
  });
  const [timingEditing, setTimingEditing] = useState(false);
  const [timingSaving, setTimingSaving] = useState(false);
  const [timingDraft, setTimingDraft] = useState({ start: '', end: '', label: '' });

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const defaultType = enabledTypes[0] || 'OTHER';
  const emptyForm = {
    id: '' as string,
    kind: (defaultType === 'CLASS' ? 'CLASS' : 'PERIOD') as 'CLASS' | 'PERIOD',
    period_type: defaultType,
    mode: 'recurring' as 'recurring' | 'oneoff',  // recurring = day-of-week; oneoff = specific_date
    specific_date: '' as string,                  // YYYY-MM-DD (used when mode = oneoff)
    day: 'Monday',                                // legacy single-day (used when editing recurring)
    days: ['Monday'] as string[],                 // multi-day selection (used when creating recurring)
    start_time: '08:00',
    end_time: '09:00',
    subject_id: '',
    teacher_id: '',
    title: '',
    color: '',
    notes: '',
    scope: 'forever' as 'forever' | 'week' | 'month' | 'term' | 'custom',
    valid_from: '' as string,                   // YYYY-MM-DD
    valid_until: '' as string,                  // YYYY-MM-DD
  };
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // ── Load school timing (admin view only) ───────────────────────────────────
  useEffect(() => {
    if (sectionsOverride) return;  // skip in teacher mode
    client.get('/schools/me/timing')
      .then(r => {
        const t = r.data || {};
        setTiming({
          day_start_time: t.day_start_time || null,
          day_end_time:   t.day_end_time   || null,
          season_label:   t.season_label   || null,
        });
        setTimingDraft({
          start: t.day_start_time || '',
          end:   t.day_end_time   || '',
          label: t.season_label   || '',
        });
      })
      .catch(() => {});
  }, [sectionsOverride]);

  const saveTiming = async () => {
    setTimingSaving(true);
    try {
      const r = await client.patch('/schools/me/timing', {
        day_start_time: timingDraft.start || null,
        day_end_time:   timingDraft.end   || null,
        season_label:   timingDraft.label || null,
      });
      const t = r.data || {};
      setTiming({
        day_start_time: t.day_start_time || null,
        day_end_time:   t.day_end_time   || null,
        season_label:   t.season_label   || null,
      });
      setTimingEditing(false);
      showToast('ok', 'School timing saved');
    } catch (e: any) {
      showToast('err', e?.response?.data?.detail || 'Failed to save timing');
    } finally {
      setTimingSaving(false);
    }
  };

  // ── Load sections list ─────────────────────────────────────────────────────
  useEffect(() => {
    if (sectionsOverride) {
      setSections(sectionsOverride);
      if (sectionsOverride.length === 1) setSectionId(sectionsOverride[0].id);
      return;
    }
    client.get('/classes').then(r => {
      const classes = Array.isArray(r.data) ? r.data : [];
      // For each class, fetch sections
      Promise.all(classes.map((c: any) =>
        client.get(`/classes/${c.id}/sections`).then(rr => (rr.data || []).map((s: any) => ({
          id: s.id,
          label: `${c.name} — Section ${s.name}`,
          class_id: c.id,
        }))).catch(() => [])
      )).then(arrs => setSections(arrs.flat()));
    }).catch(() => {});
  }, [sectionsOverride]);

  // ── When section changes, load schedule + picklists ────────────────────────
  const loadSchedule = useCallback(async () => {
    if (!sectionId) { setItems([]); return; }
    setLoading(true);
    try {
      const r = await client.get('/schedule', { params: { section_id: sectionId } });
      setItems((r.data?.items || []) as ScheduleItem[]);
    } finally { setLoading(false); }
  }, [sectionId]);

  useEffect(() => { loadSchedule(); }, [loadSchedule]);

  // Subjects/teachers — only load when CLASS slots are creatable (admin-only endpoints)
  useEffect(() => {
    if (!allowClass) return;
    client.get('/staff').then(r => setTeachers(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, [allowClass]);
  const activeSection = sections.find(s => s.id === sectionId);
  useEffect(() => {
    if (!allowClass || !activeSection?.class_id) { setSubjects([]); return; }
    client.get(`/classes/${activeSection.class_id}/subjects`)
      .then(r => setSubjects(Array.isArray(r.data) ? r.data : [])).catch(() => setSubjects([]));
  }, [allowClass, activeSection?.class_id]);

  // ── By-Date loader ─────────────────────────────────────────────────────────
  const loadByDate = useCallback(async () => {
    if (!sectionId || !byDate) { setByDateItems([]); return; }
    setByDateLoading(true);
    try {
      const r = await client.get('/schedule', { params: { section_id: sectionId, day: dayName(byDate) } });
      // Filter to slots active on this date — backend already filters per-day,
      // but for an explicit date we need to also honor validity window + specific_date.
      const all: ScheduleItem[] = r.data?.items || [];
      const target = byDate;
      const targetD = new Date(target + 'T00:00:00');
      const filtered = all.filter(it => {
        if (it.specific_date) return it.specific_date === target;
        if (it.valid_from && new Date(it.valid_from + 'T00:00:00') > targetD) return false;
        if (it.valid_until && new Date(it.valid_until + 'T00:00:00') < targetD) return false;
        return true;
      });
      filtered.sort((a, b) => a.start_time.localeCompare(b.start_time));
      setByDateItems(filtered);
    } finally { setByDateLoading(false); }
  }, [sectionId, byDate]);

  useEffect(() => { if (tab === 'bydate') loadByDate(); }, [tab, loadByDate]);

  // ── Modal helpers ──────────────────────────────────────────────────────────
  const defaultStartType = allowClass ? 'CLASS' : defaultType;
  const defaultStart = timing.day_start_time || '08:00';
  const defaultEnd   = timing.day_end_time   || '09:00';

  type Preset = {
    day?: string;
    days?: string[];
    scope?: typeof emptyForm.scope;
    mode?: 'recurring' | 'oneoff';
    specific_date?: string;
  };

  const openCreate = (preset: Preset = {}) => {
    const startType = defaultStartType;
    setForm({
      ...emptyForm,
      day: preset.day || 'Monday',
      days: preset.days || (preset.day ? [preset.day] : ['Monday']),
      period_type: startType,
      kind: startType === 'CLASS' ? 'CLASS' : 'PERIOD',
      scope: preset.scope || 'forever',
      mode: preset.mode || 'recurring',
      specific_date: preset.specific_date || '',
      start_time: timing.day_start_time || emptyForm.start_time,
      end_time: timing.day_start_time ? addMinutes(timing.day_start_time, 60) : emptyForm.end_time,
    });
    setModalOpen(true);
  };

  const openEdit = (it: ScheduleItem) => {
    const isOneOff = !!it.specific_date;
    setForm({
      id: it.id,
      kind: it.kind,
      period_type: it.period_type,
      mode: isOneOff ? 'oneoff' : 'recurring',
      specific_date: it.specific_date || '',
      day: it.day,
      days: [it.day],
      start_time: it.start_time,
      end_time: it.end_time,
      subject_id: it.subject_id || '',
      teacher_id: it.teacher_id || '',
      title: it.title || '',
      color: it.color || '',
      notes: it.notes || '',
      scope: (it.valid_from || it.valid_until) ? 'custom' : 'forever',
      valid_from: it.valid_from || '',
      valid_until: it.valid_until || '',
    });
    setModalOpen(true);
  };

  // Helper — compute valid_from/valid_until based on `scope`
  const computeValidity = (scope: typeof emptyForm.scope, vf: string, vu: string) => {
    const today = new Date();
    const iso = (d: Date) => localISODate(d);
    switch (scope) {
      case 'forever': return { valid_from: null, valid_until: null };
      case 'week': {
        // until coming Sunday
        const end = new Date(today);
        const daysToSunday = (7 - today.getDay()) % 7 || 7;
        end.setDate(today.getDate() + daysToSunday);
        return { valid_from: iso(today), valid_until: iso(end) };
      }
      case 'month': {
        const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        return { valid_from: iso(today), valid_until: iso(end) };
      }
      case 'term': {
        // "For the year" — exactly 12 months from today
        const end = new Date(today);
        end.setFullYear(today.getFullYear() + 1);
        end.setDate(end.getDate() - 1);
        return { valid_from: iso(today), valid_until: iso(end) };
      }
      case 'custom':
        return { valid_from: vf || null, valid_until: vu || null };
    }
  };

  const handleSave = async () => {
    if (!sectionId) return;
    const isClass = form.period_type === 'CLASS';
    const editing = !!form.id;
    const isOneOff = form.mode === 'oneoff';

    if (isClass && (!form.subject_id || !form.teacher_id)) {
      showToast('err', 'Please pick a subject and a teacher.');
      return;
    }
    if (!isClass && !form.title.trim()) {
      showToast('err', 'Please enter a title (e.g. "Morning Prayer").');
      return;
    }
    if (form.start_time >= form.end_time) {
      showToast('err', 'End time must be after start time.');
      return;
    }
    if (isOneOff && !form.specific_date) {
      showToast('err', 'Pick a specific date.');
      return;
    }

    // Resolve days for recurring mode
    const days = editing ? [form.day] : (form.days.length > 0 ? form.days : [form.day]);
    if (!isOneOff && !editing && days.length === 0) {
      showToast('err', 'Pick at least one day.');
      return;
    }

    const { valid_from, valid_until } = computeValidity(form.scope, form.valid_from, form.valid_until);
    if (!isOneOff && valid_from && valid_until && valid_from > valid_until) {
      showToast('err', 'End date must be on or after start date.');
      return;
    }

    setSaving(true);
    try {
      if (isClass) {
        // Academic CLASS — uses the same validity / specific_date / date_range modes as periods
        const useDateRange = !isOneOff && (form.scope === 'week' || form.scope === 'month' || form.scope === 'term' || form.scope === 'custom') && valid_from && valid_until;
        const base: any = {
          section_id: sectionId,
          subject_id: form.subject_id,
          teacher_id: form.teacher_id,
          start_time: form.start_time,
          end_time: form.end_time,
          skip_sundays: true,
        };
        if (isOneOff) {
          base.specific_date = form.specific_date;
        } else if (useDateRange) {
          base.mode = 'date_range';
          base.valid_from = valid_from;
          base.valid_until = valid_until;
        } else {
          base.mode = 'recurring';
          base.valid_from = valid_from;
          base.valid_until = valid_until;
        }
        if (editing) {
          await client.patch(`/timetable/${form.id}`, {
            ...base,
            day: form.day,
            clear_valid_from: !isOneOff && valid_from === null,
            clear_valid_until: !isOneOff && valid_until === null,
            clear_specific_date: !isOneOff,
          });
          showToast('ok', 'Class slot updated');
        } else {
          if (isOneOff) {
            await client.post('/timetable', base);
            showToast('ok', `Added one-off class slot on ${form.specific_date}`);
          } else {
            const r = await client.post('/timetable', { ...base, days });
            const count = r.data?.count ?? days.length;
            const skipped = Array.isArray(r.data?.skipped_dates) ? r.data.skipped_dates : [];
            const holidayCount = skipped.filter((s: any) => s.reason?.startsWith('Holiday')).length;
            const sundayCount = skipped.filter((s: any) => s.reason === 'Sunday').length;
            const isDateRange = base.mode === 'date_range';
            let msg = isDateRange && valid_from && valid_until
              ? `Added ${count} class slot${count === 1 ? '' : 's'} between ${valid_from} and ${valid_until}`
              : `Added ${count} class slot${count === 1 ? '' : 's'} (forever recurring)`;
            if (holidayCount > 0 || sundayCount > 0) {
              const parts: string[] = [];
              if (holidayCount > 0) parts.push(`${holidayCount} holiday`);
              if (sundayCount > 0) parts.push(`${sundayCount} Sunday`);
              msg += ` — skipped ${parts.join(' + ')} date${holidayCount + sundayCount === 1 ? '' : 's'}`;
            }
            showToast('ok', msg);
          }
        }
      } else {
        const auto = PERIOD_BY_KEY[form.period_type];
        const base: any = {
          section_id: sectionId,
          start_time: form.start_time,
          end_time: form.end_time,
          period_type: form.period_type,
          title: form.title.trim(),
          color: form.color || auto?.color || null,
          notes: form.notes || null,
          skip_sundays: true,
        };
        // Bounded scopes (week/month/term/custom) → enumerate dates and skip holidays + Sundays per day
        const useDateRange = !isOneOff && (form.scope === 'week' || form.scope === 'month' || form.scope === 'term' || form.scope === 'custom') && valid_from && valid_until;
        if (isOneOff) {
          base.specific_date = form.specific_date;
        } else if (useDateRange) {
          base.mode = 'date_range';
          base.valid_from = valid_from;
          base.valid_until = valid_until;
        } else {
          base.mode = 'recurring';
          base.valid_from = valid_from;
          base.valid_until = valid_until;
        }
        if (editing) {
          await client.patch(`/periods/${form.id}`, {
            ...base,
            day: form.day,
            clear_valid_from: !isOneOff && valid_from === null,
            clear_valid_until: !isOneOff && valid_until === null,
            clear_specific_date: !isOneOff,
          });
          showToast('ok', 'Slot updated');
        } else {
          if (isOneOff) {
            const r = await client.post('/periods', base);
            showToast('ok', `Added one-off slot on ${form.specific_date}`);
          } else {
            const r = await client.post('/periods', { ...base, days });
            const count = r.data?.count ?? days.length;
            const skipped = Array.isArray(r.data?.skipped_dates) ? r.data.skipped_dates : [];
            const holidayCount = skipped.filter((s: any) => s.reason?.startsWith('Holiday')).length;
            const sundayCount = skipped.filter((s: any) => s.reason === 'Sunday').length;
            const isDateRange = base.mode === 'date_range';
            let msg = isDateRange && valid_from && valid_until
              ? `Added ${count} slot${count === 1 ? '' : 's'} between ${valid_from} and ${valid_until}`
              : `Added ${count} slot${count === 1 ? '' : 's'} (forever recurring)`;
            if (holidayCount > 0 || sundayCount > 0) {
              const parts: string[] = [];
              if (holidayCount > 0) parts.push(`${holidayCount} holiday`);
              if (sundayCount > 0) parts.push(`${sundayCount} Sunday`);
              msg += ` — skipped ${parts.join(' + ')} date${holidayCount + sundayCount === 1 ? '' : 's'}`;
            }
            showToast('ok', msg);
          }
        }
      }
      setModalOpen(false);
      await loadSchedule();
      if (tab === 'bydate') await loadByDate();
    } catch (e: any) {
      const d = e?.response?.data?.detail;
      const msg = typeof d === 'string' ? d : (d?.message || 'Failed to save');
      showToast('err', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (it: ScheduleItem) => {
    if (!confirm(`Delete "${it.title}" — ${it.specific_date || it.day} ${it.start_time}–${it.end_time}?`)) return;
    try {
      if (it.kind === 'CLASS') await client.delete(`/timetable/${it.id}`);
      else await client.delete(`/periods/${it.id}`);
      showToast('ok', 'Slot deleted');
      await loadSchedule();
      if (tab === 'bydate') await loadByDate();
    } catch (e: any) {
      showToast('err', e?.response?.data?.detail || 'Delete failed');
    }
  };

  // ── Group by day (Weekly Pattern shows only TRUE recurring slots — no specific_date) ──
  // Specific-date / one-off entries belong in the By Date tab. Keeping them here would
  // stack many rows under one weekday column and look like "forever recurring".
  const recurringOnly = useMemo(() => items.filter(it => !it.is_one_off), [items]);
  const oneOffCount = useMemo(() => items.filter(it => it.is_one_off).length, [items]);
  const byDay = useMemo(() => {
    const map: Record<string, ScheduleItem[]> = {};
    DAYS.forEach(d => map[d] = []);
    recurringOnly.forEach(it => { if (map[it.day]) map[it.day].push(it); });
    Object.values(map).forEach(arr => arr.sort((a, b) => a.start_time.localeCompare(b.start_time)));
    return map;
  }, [recurringOnly]);

  // Stats
  const totalSlots = items.length;
  const classCount = items.filter(i => i.kind === 'CLASS').length;
  const periodCount = items.filter(i => i.kind === 'PERIOD').length;
  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });

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
          <h1>📅 {title || 'Timetable & Periods'}</h1>
          <p style={{ color: 'var(--gray-400)', fontSize: '0.85rem', margin: '4px 0 0' }}>
            {subtitle || 'Manage classes, lunch, prayer, sports — everything that happens during the day. Parents and students see live updates.'}
          </p>
        </div>
      </div>

      {/* School day timing card (admin only) */}
      {!sectionsOverride && !viewOnly && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{
              width: 38, height: 38, borderRadius: '50%',
              background: 'var(--primary-50)', color: 'var(--primary-600)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <FiClock size={18} />
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                School day timing
                {timing.season_label && !timingEditing && (
                  <span style={{ marginLeft: 8, fontSize: '0.72rem', padding: '2px 8px', borderRadius: 10, background: 'var(--primary-50)', color: 'var(--primary-600)', fontWeight: 600 }}>
                    {timing.season_label}
                  </span>
                )}
              </div>
              {!timingEditing ? (
                <div style={{ color: 'var(--gray-500)', fontSize: '0.85rem', marginTop: 2 }}>
                  {timing.day_start_time && timing.day_end_time
                    ? <>School runs <strong>{timing.day_start_time} – {timing.day_end_time}</strong> · used as the default slot time</>
                    : <>No school timing set yet — click <em>Edit</em> to set start &amp; end (e.g. Summer 08:00–13:00, Winter 09:00–14:00)</>}
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
                  <input type="time" value={timingDraft.start}
                    onChange={e => setTimingDraft(d => ({ ...d, start: e.target.value }))}
                    style={{ padding: '4px 8px', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }} />
                  <span style={{ color: 'var(--gray-400)' }}>to</span>
                  <input type="time" value={timingDraft.end}
                    onChange={e => setTimingDraft(d => ({ ...d, end: e.target.value }))}
                    style={{ padding: '4px 8px', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }} />
                  <input type="text" placeholder="Label (e.g. Summer Term)" value={timingDraft.label}
                    onChange={e => setTimingDraft(d => ({ ...d, label: e.target.value }))}
                    style={{ padding: '4px 8px', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', minWidth: 160 }} />
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {!timingEditing ? (
                <button className="btn btn-secondary btn-sm" onClick={() => setTimingEditing(true)} style={{ width: 'auto' }}>
                  <FiEdit2 size={12} /> Edit
                </button>
              ) : (
                <>
                  <button className="btn btn-secondary btn-sm" onClick={() => {
                    setTimingEditing(false);
                    setTimingDraft({ start: timing.day_start_time || '', end: timing.day_end_time || '', label: timing.season_label || '' });
                  }} style={{ width: 'auto' }}>Cancel</button>
                  <button className="btn btn-primary btn-sm" onClick={saveTiming} disabled={timingSaving} style={{ width: 'auto' }}>
                    <FiSave size={12} /> {timingSaving ? 'Saving…' : 'Save'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Section picker */}
      {showSectionPicker && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-body">
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--gray-600)', display: 'block', marginBottom: 6 }}>
              Section
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {sections.length === 0 ? (
                <p style={{ color: 'var(--gray-400)', fontSize: '0.85rem' }}>No sections available.</p>
              ) : sections.map(s => (
                <button
                  key={s.id}
                  className={`btn btn-sm ${sectionId === s.id ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setSectionId(s.id)}
                  style={{ width: 'auto' }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {!sectionId ? (
        <div className="card">
          <div className="empty-state">
            <FiCalendar size={32} style={{ color: 'var(--gray-300)' }} />
            <h3>Select a section</h3>
            <p>Pick a section above to view and manage its weekly schedule.</p>
          </div>
        </div>
      ) : (
        <>
          {/* Quick-add action bar (admin only) */}
          {!viewOnly && (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div className="card-body" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--gray-500)', marginRight: 4 }}>Quick add</span>
                <button className="btn btn-secondary btn-sm" style={{ width: 'auto' }}
                  onClick={() => openCreate({ days: ['Monday'], scope: 'forever' })}>
                  <FiPlus size={12} /> Just one day
                </button>
                <button className="btn btn-secondary btn-sm" style={{ width: 'auto' }}
                  onClick={() => openCreate({ days: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'], scope: 'week' })}>
                  <FiPlus size={12} /> For this week
                </button>
                <button className="btn btn-secondary btn-sm" style={{ width: 'auto' }}
                  onClick={() => openCreate({ days: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'], scope: 'month' })}>
                  <FiPlus size={12} /> For this month
                </button>
                <button className="btn btn-secondary btn-sm" style={{ width: 'auto' }}
                  onClick={() => openCreate({ days: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'], scope: 'term' })}>
                  <FiPlus size={12} /> For the year
                </button>
                <button className="btn btn-secondary btn-sm" style={{ width: 'auto' }}
                  onClick={() => openCreate({ mode: 'oneoff', specific_date: localISODate() })}>
                  <FiCalendar size={12} /> Specific date only
                </button>
              </div>
            </div>
          )}

          {/* Summary chips */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1rem' }}>
            <Chip label="Recurring slots" value={recurringOnly.length} color="var(--gray-700)" bg="var(--gray-100)" />
            <Chip label="Academic classes" value={classCount} color="#6366f1" bg="#eef2ff" />
            <Chip label="Other periods" value={periodCount} color="#8b5cf6" bg="#ede9fe" />
            {oneOffCount > 0 && (
              <Chip label="One-off dates" value={oneOffCount} color="#d97706" bg="#fef3c7" />
            )}
          </div>

          {/* Legend */}
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div className="card-body" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {PERIOD_TYPES.map(p => {
                const Icon = p.icon;
                return (
                  <div key={p.key} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '4px 10px', borderRadius: 'var(--radius-full)',
                    background: p.bg, color: p.color, fontSize: '0.78rem', fontWeight: 600,
                  }}>
                    <Icon size={12} /> {p.label}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tabs: Weekly Pattern / By Date */}
          <div className="tabs">
            <button className={`tab ${tab === 'weekly' ? 'active' : ''}`} onClick={() => setTab('weekly')}>
              Weekly Pattern
            </button>
            <button className={`tab ${tab === 'bydate' ? 'active' : ''}`} onClick={() => setTab('bydate')}>
              By Date
            </button>
          </div>

          {tab === 'bydate' ? (
            <ByDateView
              date={byDate}
              setDate={setByDate}
              items={byDateItems}
              loading={byDateLoading}
              onAddForDate={() => openCreate({ mode: 'oneoff', specific_date: byDate })}
              onEdit={(it) => openEdit(it)}
              onDelete={(it) => handleDelete(it)}
              readOnlyDisallowed={!!readOnlyDisallowed}
              enabledTypes={enabledTypes}
              viewOnly={!!viewOnly}
            />
          ) : loading ? (
            <div className="card"><div className="spinner-container"><div className="spinner" /></div></div>
          ) : (
          <>
            {/* Banner when there are one-off slots */}
            {oneOffCount > 0 && (
              <div className="card" style={{
                marginBottom: '0.75rem', padding: 12,
                background: 'linear-gradient(135deg, #fff7ed 0%, #fff 80%)',
                borderLeft: '4px solid #d97706',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.85rem' }}>
                  <FiCalendar style={{ color: '#d97706' }} />
                  <span>
                    <strong>{oneOffCount} one-off date{oneOffCount === 1 ? '' : 's'}</strong> not shown here —
                    this view is the <strong>recurring weekly pattern</strong>. Switch to
                    <button onClick={() => setTab('bydate')} style={{ background: 'transparent', border: 'none', color: 'var(--primary-600)', fontWeight: 700, cursor: 'pointer', padding: '0 4px' }}>By Date</button>
                    to manage individual dates.
                  </span>
                </div>
              </div>
            )}
            <p style={{ fontSize: '0.78rem', color: 'var(--gray-500)', margin: '0 0 8px' }}>
              Showing the <strong>recurring weekly pattern</strong>. Bounded slots (this week / month / year) appear in the <strong>By Date</strong> tab on the dates they apply to.
            </p>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
            {DAYS.map(day => {
              const isToday = day === todayName;
              const dayItems = byDay[day];
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <h3 style={{
                          margin: 0,
                          fontSize: isToday ? '1.05rem' : '0.95rem',
                          fontWeight: isToday ? 800 : 700,
                          color: isToday ? 'var(--primary-700)' : 'var(--gray-700)',
                        }}>{day}</h3>
                        <span style={{ color: 'var(--gray-400)', fontSize: '0.78rem' }}>{dayItems.length} {dayItems.length === 1 ? 'slot' : 'slots'}</span>
                      </div>
                      {!viewOnly && (
                        <button className="btn btn-secondary btn-sm" onClick={() => openCreate({ day, days: [day] })} style={{ width: 'auto', fontSize: '0.75rem' }}>
                          <FiPlus size={12} /> Add to {day}
                        </button>
                      )}
                    </div>
                    {dayItems.length === 0 ? (
                      <p style={{ color: 'var(--gray-400)', fontSize: '0.82rem', margin: 0 }}>No slots scheduled.</p>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                        {dayItems.map(it => {
                          const editable = !viewOnly && (!readOnlyDisallowed || enabledTypes.includes(it.period_type));
                          return (
                            <SlotCard
                              key={it.id}
                              item={it}
                              onEdit={editable ? () => openEdit(it) : undefined}
                              onDelete={editable ? () => handleDelete(it) : undefined}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          </>
          )}
        </>
      )}

      {/* Add / Edit modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{form.id ? 'Edit Slot' : 'Add Slot'}</h3>
              <button className="modal-close" onClick={() => setModalOpen(false)}><FiX /></button>
            </div>
            <div className="modal-body" style={{ display: 'grid', gap: '0.9rem' }}>
              {/* Type picker — chip grid */}
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--gray-600)', display: 'block', marginBottom: 6 }}>Type</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {PERIOD_TYPES.filter(p => enabledTypes.includes(p.key)).map(p => {
                    const Icon = p.icon;
                    const active = form.period_type === p.key;
                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, period_type: p.key }))}
                        disabled={!!form.id && (form.kind === 'CLASS') !== (p.key === 'CLASS')}
                        title={(!!form.id && (form.kind === 'CLASS') !== (p.key === 'CLASS')) ? 'Cannot switch between Class and non-Class when editing — delete and re-create instead' : ''}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '6px 12px', borderRadius: 'var(--radius-full)',
                          border: `1.5px solid ${active ? p.color : 'var(--gray-200)'}`,
                          background: active ? p.bg : '#fff',
                          color: active ? p.color : 'var(--gray-500)',
                          fontWeight: active ? 700 : 500, fontSize: '0.82rem',
                          cursor: 'pointer',
                          opacity: (!!form.id && (form.kind === 'CLASS') !== (p.key === 'CLASS')) ? 0.4 : 1,
                        }}
                      >
                        <Icon size={13} /> {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label>Start</label>
                  <input type="time" className="form-input" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>End</label>
                  <input type="time" className="form-input" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
                </div>
              </div>

              {/* When — Recurring vs Specific date (non-CLASS only) */}
              {!form.id && (
                <div className="form-group">
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--gray-600)', display: 'block', marginBottom: 6 }}>When</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {([
                      { key: 'recurring', label: 'Repeats every week', hint: 'pick days of week' },
                      { key: 'oneoff',    label: 'On a specific date only', hint: 'one-off override' },
                    ] as const).map(opt => {
                      const active = form.mode === opt.key;
                      return (
                        <button key={opt.key} type="button" title={opt.hint}
                          onClick={() => setForm(f => ({
                            ...f,
                            mode: opt.key,
                            specific_date: opt.key === 'oneoff' && !f.specific_date ? localISODate() : f.specific_date,
                          }))}
                          style={{
                            flex: 1, padding: '8px 12px', borderRadius: 'var(--radius-md)',
                            border: `1.5px solid ${active ? 'var(--primary-500)' : 'var(--gray-200)'}`,
                            background: active ? 'var(--primary-50)' : '#fff',
                            color: active ? 'var(--primary-700)' : 'var(--gray-600)',
                            fontWeight: active ? 700 : 500, fontSize: '0.85rem', cursor: 'pointer',
                          }}>{opt.label}</button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Day picker — multi when creating recurring, single when editing recurring, date input when one-off */}
              {form.mode === 'oneoff' ? (
                <div className="form-group">
                  <label>Specific date</label>
                  <input type="date" className="form-input" value={form.specific_date}
                    min={localISODate()}
                    onChange={e => setForm(f => ({ ...f, specific_date: e.target.value }))} />
                  {form.specific_date && (
                    <p style={{ fontSize: '0.74rem', color: 'var(--gray-500)', marginTop: 4 }}>
                      Will apply on <strong>{prettyDate(form.specific_date)}</strong> only.
                    </p>
                  )}
                </div>
              ) : form.id ? (
                <div className="form-group">
                  <label>Day</label>
                  <select className="form-input" value={form.day} onChange={e => setForm(f => ({ ...f, day: e.target.value }))}>
                    {DAY_OPTIONS.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
              ) : (
                <div className="form-group">
                  <label>
                    Days <span style={{ marginLeft: 6, fontSize: '0.72rem', color: 'var(--gray-400)', fontWeight: 500 }}>
                      pick one or many — one slot is created per day
                    </span>
                  </label>
                  {/* Presets */}
                  <div style={{ display: 'flex', gap: 4, marginBottom: 6, flexWrap: 'wrap' }}>
                    {([
                      { label: 'Just one', value: [form.days[0] || 'Monday'] },
                      { label: 'Mon–Fri', value: ['Monday','Tuesday','Wednesday','Thursday','Friday'] },
                      { label: 'Mon–Sat', value: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'] },
                    ] as const).map(p => (
                      <button key={p.label} type="button"
                        onClick={() => setForm(f => ({ ...f, days: [...p.value] }))}
                        style={{
                          fontSize: '0.72rem', padding: '4px 9px',
                          background: 'var(--gray-50)', border: '1px solid var(--gray-200)',
                          borderRadius: 'var(--radius-full)', cursor: 'pointer', color: 'var(--gray-700)',
                        }}>{p.label}</button>
                    ))}
                  </div>
                  {/* Day chips */}
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {DAY_OPTIONS.map(d => {
                      const active = form.days.includes(d);
                      return (
                        <button key={d} type="button"
                          onClick={() => setForm(f => ({
                            ...f,
                            days: active ? f.days.filter(x => x !== d) : [...f.days, d],
                          }))}
                          style={{
                            padding: '6px 12px', borderRadius: 'var(--radius-full)',
                            border: `1.5px solid ${active ? 'var(--primary-500)' : 'var(--gray-200)'}`,
                            background: active ? 'var(--primary-50)' : '#fff',
                            color: active ? 'var(--primary-700)' : 'var(--gray-600)',
                            fontWeight: active ? 700 : 500, fontSize: '0.82rem',
                            cursor: 'pointer', minWidth: 50,
                          }}>{d.slice(0, 3)}</button>
                      );
                    })}
                  </div>
                  {form.days.length === 0 && (
                    <p style={{ fontSize: '0.74rem', color: 'var(--danger-500)', marginTop: 4 }}>Pick at least one day.</p>
                  )}
                </div>
              )}

              {/* Repeats for — only for non-CLASS recurring (TimetableSlot has no validity; one-off has no scope) */}
              {form.mode !== 'oneoff' && (
                <div className="form-group">
                  <label>
                    Repeats for
                    <span style={{ marginLeft: 6, fontSize: '0.72rem', color: 'var(--gray-400)', fontWeight: 500 }}>
                      how long this slot stays in the schedule
                    </span>
                  </label>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: form.scope === 'custom' ? 8 : 0 }}>
                    {([
                      { key: 'forever', label: 'Forever',     hint: 'recurs every week, no end' },
                      { key: 'week',    label: 'This week',   hint: 'until coming Sunday' },
                      { key: 'month',   label: 'This month',  hint: 'until end of current month' },
                      { key: 'term',    label: 'This term',   hint: 'until 30 June (academic year)' },
                      { key: 'custom',  label: 'Custom dates',hint: 'pick start & end' },
                    ] as const).map(opt => {
                      const active = form.scope === opt.key;
                      return (
                        <button key={opt.key} type="button" title={opt.hint}
                          onClick={() => setForm(f => ({ ...f, scope: opt.key }))}
                          style={{
                            padding: '6px 12px', borderRadius: 'var(--radius-full)',
                            border: `1.5px solid ${active ? 'var(--primary-500)' : 'var(--gray-200)'}`,
                            background: active ? 'var(--primary-50)' : '#fff',
                            color: active ? 'var(--primary-700)' : 'var(--gray-600)',
                            fontWeight: active ? 700 : 500, fontSize: '0.78rem', cursor: 'pointer',
                          }}>{opt.label}</button>
                      );
                    })}
                  </div>
                  {form.scope === 'custom' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <label style={{ fontSize: '0.72rem', color: 'var(--gray-500)' }}>From (optional)</label>
                        <input type="date" className="form-input" value={form.valid_from}
                          onChange={e => setForm(f => ({ ...f, valid_from: e.target.value }))} />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.72rem', color: 'var(--gray-500)' }}>Until (optional)</label>
                        <input type="date" className="form-input" value={form.valid_until}
                          onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))} />
                      </div>
                    </div>
                  )}
                  {/* Live preview */}
                  {(() => {
                    const { valid_from, valid_until } = computeValidity(form.scope, form.valid_from, form.valid_until);
                    if (!valid_from && !valid_until) return null;
                    const f = valid_from ? new Date(valid_from).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
                    const u = valid_until ? new Date(valid_until).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'no end';
                    return (
                      <p style={{ fontSize: '0.74rem', color: 'var(--gray-500)', marginTop: 6 }}>
                        Active from <strong>{f}</strong> until <strong>{u}</strong>.
                      </p>
                    );
                  })()}
                </div>
              )}

              {form.period_type === 'CLASS' ? (() => {
                // Only teachers who teach the picked subject in THIS class.
                // Subject rows are class-specific, so subject_id alone is enough — a teacher
                // who has this subject_id in their list necessarily teaches it in this class.
                const teachersForSubject = form.subject_id
                  ? teachers.filter(t => Array.isArray(t.subject_ids) && t.subject_ids.includes(form.subject_id))
                  : [];
                return (
                  <>
                    <div className="form-group">
                      <label>Subject <span style={{ color: 'var(--danger-500)' }}>*</span></label>
                      <select
                        className="form-input"
                        value={form.subject_id}
                        onChange={e => {
                          const newSubject = e.target.value;
                          setForm(f => {
                            // Drop teacher if they don't teach the new subject
                            const t = teachers.find(x => x.id === f.teacher_id);
                            const teacherStillValid = !!newSubject && t && Array.isArray(t.subject_ids) && t.subject_ids.includes(newSubject);
                            return { ...f, subject_id: newSubject, teacher_id: teacherStillValid ? f.teacher_id : '' };
                          });
                        }}
                      >
                        <option value="">Select subject…</option>
                        {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>
                        Teacher <span style={{ color: 'var(--danger-500)' }}>*</span>
                        {form.subject_id && (
                          <span style={{ marginLeft: 8, fontSize: '0.72rem', color: 'var(--gray-400)', fontWeight: 500 }}>
                            {teachersForSubject.length} who teach{teachersForSubject.length === 1 ? 'es' : ''} this subject
                          </span>
                        )}
                      </label>
                      <select
                        className="form-input"
                        value={form.teacher_id}
                        onChange={e => setForm(f => ({ ...f, teacher_id: e.target.value }))}
                        disabled={!form.subject_id}
                      >
                        {!form.subject_id ? (
                          <option value="">Pick a subject first…</option>
                        ) : teachersForSubject.length === 0 ? (
                          <option value="">No teachers assigned to this subject</option>
                        ) : (
                          <>
                            <option value="">Select teacher…</option>
                            {teachersForSubject.map(t => (
                              <option key={t.id} value={t.id}>
                                {t.first_name} {t.last_name}{t.department ? ` · ${t.department}` : ''}
                              </option>
                            ))}
                          </>
                        )}
                      </select>
                      {form.subject_id && teachersForSubject.length === 0 && (
                        <p style={{ fontSize: '0.74rem', color: 'var(--warning-600, #d97706)', marginTop: 4 }}>
                          No teacher is currently assigned to this subject. Open <strong>Teachers</strong> → edit a teacher and add this subject to their list.
                        </p>
                      )}
                    </div>
                  </>
                );
              })() : (
                <>
                  <div className="form-group">
                    <label>Title</label>
                    <input className="form-input" placeholder="e.g. Morning Prayer, Lunch Break, Sports - Cricket" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Notes (optional)</label>
                    <input className="form-input" placeholder="e.g. Bring sports shoes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : form.id ? 'Save Changes' : 'Add Slot'}
              </button>
            </div>
          </div>
        </div>
      )}
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

function fmtShort(d?: string | null) {
  if (!d) return null;
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function SlotCard({ item, onEdit, onDelete }: { item: ScheduleItem; onEdit?: () => void; onDelete?: () => void }) {
  const meta = PERIOD_BY_KEY[item.period_type] || PERIOD_BY_KEY.OTHER;
  const Icon = meta.icon;
  const bg = item.color ? `${item.color}15` : meta.bg;
  const color = item.color || meta.color;

  const today = new Date(); today.setHours(0,0,0,0);
  const vu = item.valid_until ? new Date(item.valid_until + 'T00:00:00') : null;
  const vf = item.valid_from ? new Date(item.valid_from + 'T00:00:00') : null;
  const isExpiring = vu && (vu.getTime() - today.getTime()) / 86400000 <= 14 && vu >= today;
  const isFuture = vf && vf > today;
  const validityText = item.valid_until ? `until ${fmtShort(item.valid_until)}` : item.valid_from ? `from ${fmtShort(item.valid_from)}` : null;

  return (
    <div style={{
      background: bg, border: `1px solid ${color}30`, borderRadius: 10,
      padding: '0.7rem 0.85rem', position: 'relative',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon size={13} style={{ color }} />
        <span style={{ fontWeight: 700, color, fontSize: '0.88rem', lineHeight: 1.2 }}>{item.title}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--gray-600)', fontSize: '0.78rem' }}>
        <FiClock size={11} /> {item.start_time} – {item.end_time}
      </div>
      {item.teacher_name && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--gray-500)', fontSize: '0.76rem' }}>
          <FiUser size={11} /> {item.teacher_name}
        </div>
      )}
      {item.notes && (
        <div style={{ color: 'var(--gray-500)', fontSize: '0.74rem', fontStyle: 'italic' }}>{item.notes}</div>
      )}
      {validityText && (
        <div style={{
          display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: 3,
          marginTop: 2, padding: '2px 7px', borderRadius: 'var(--radius-full)',
          fontSize: '0.66rem', fontWeight: 600,
          background: isExpiring ? 'var(--warning-50, #fff7ed)' : isFuture ? 'var(--info-50, #eff6ff)' : 'rgba(255,255,255,0.7)',
          color: isExpiring ? 'var(--warning-600, #d97706)' : isFuture ? 'var(--info-600, #2563eb)' : 'var(--gray-500)',
          border: `1px solid ${isExpiring ? 'var(--warning-600, #d97706)' : isFuture ? 'var(--info-600, #2563eb)' : 'var(--gray-200)'}30`,
        }}>
          <FiCalendar size={9} /> {validityText}
        </div>
      )}
      {(onEdit || onDelete) && (
        <div style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 2 }}>
          {onEdit && (
            <button onClick={onEdit} className="btn-icon" title="Edit"
              style={{ padding: 3, background: 'rgba(255,255,255,0.7)' }}>
              <FiEdit2 size={11} />
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete} className="btn-icon" title="Delete"
              style={{ padding: 3, background: 'rgba(255,255,255,0.7)', color: 'var(--danger-500)' }}>
              <FiTrash2 size={11} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── By-Date view ─────────────────────────────────────────────────────────────

function ByDateView({
  date, setDate, items, loading, onAddForDate, onEdit, onDelete, readOnlyDisallowed, enabledTypes, viewOnly,
}: {
  date: string;
  setDate: (d: string) => void;
  items: ScheduleItem[];
  loading: boolean;
  onAddForDate: () => void;
  onEdit: (it: ScheduleItem) => void;
  onDelete: (it: ScheduleItem) => void;
  readOnlyDisallowed: boolean;
  enabledTypes: string[];
  viewOnly: boolean;
}) {
  const shiftDate = (delta: number) => setDate(shiftISODate(date, delta));
  const isToday = date === localISODate();
  const dow = dayName(date);
  const isSunday = dow === 'Sunday';

  // Check holiday for this date
  const [holiday, setHoliday] = useState<any>(null);
  useEffect(() => {
    if (!date) { setHoliday(null); return; }
    client.get(`/holidays/on/${date}`)
      .then(r => setHoliday(r.data || null))
      .catch(() => setHoliday(null));
  }, [date]);

  // Hide all slots on Sundays and holidays — no school happens
  const isOffDay = isSunday || !!holiday;
  const visibleItems = isOffDay ? [] : items;

  return (
    <div>
      {/* Date nav */}
      <div className="card" style={{ marginBottom: '0.75rem' }}>
        <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn-icon" onClick={() => shiftDate(-1)} title="Previous day"><FiChevronLeft /></button>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            style={{ padding: '6px 10px', border: '1.5px solid var(--gray-200)', borderRadius: 'var(--radius-md)', fontSize: '0.88rem' }} />
          <button className="btn-icon" onClick={() => shiftDate(1)} title="Next day"><FiChevronRight /></button>
          <div style={{ marginLeft: 8 }}>
            <div style={{ fontWeight: 700, fontSize: '0.98rem' }}>{prettyDate(date)}</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
              {isToday && <span className="badge badge-primary" style={{ fontSize: '0.68rem' }}>● TODAY</span>}
              {isSunday && <span className="badge badge-warning" style={{ fontSize: '0.68rem' }}>Sunday (off)</span>}
              {holiday && <span className="badge" style={{ fontSize: '0.68rem', background: '#fee2e2', color: '#dc2626' }}>🎉 Holiday</span>}
              <span style={{ fontSize: '0.78rem', color: 'var(--gray-500)' }}>{visibleItems.length} {visibleItems.length === 1 ? 'slot' : 'slots'}</span>
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <button className="btn btn-secondary btn-sm" style={{ width: 'auto' }} onClick={() => setDate(localISODate())}>Today</button>
          {!viewOnly && !isOffDay && (
            <button className="btn btn-primary btn-sm" style={{ width: 'auto' }} onClick={onAddForDate}>
              <FiPlus size={12} /> Add slot for this date only
            </button>
          )}
        </div>
      </div>

      {/* Holiday banner */}
      {holiday && (
        <div className="card" style={{
          marginBottom: '0.75rem', padding: 16,
          background: 'linear-gradient(135deg, #fee2e2 0%, #ede9fe 60%, #fff 100%)',
          borderLeft: '4px solid #dc2626',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: '1.6rem', lineHeight: 1 }}>🎉</div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#dc2626', letterSpacing: 0.5, textTransform: 'uppercase' }}>Holiday</div>
              <h3 style={{ margin: '2px 0 2px', fontSize: '1.05rem', color: 'var(--gray-900)' }}>{holiday.title}</h3>
              <div style={{ fontSize: '0.82rem', color: 'var(--gray-600)' }}>
                School is closed — no periods on this date.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sunday banner */}
      {isSunday && !holiday && (
        <div className="card" style={{
          marginBottom: '0.75rem', padding: 16,
          background: 'linear-gradient(135deg, #fff7ed 0%, #fff 80%)',
          borderLeft: '4px solid #d97706',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: '1.6rem' }}>🌙</div>
            <div>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#d97706', letterSpacing: 0.5, textTransform: 'uppercase' }}>Sunday</div>
              <h3 style={{ margin: '2px 0 2px', fontSize: '1.05rem', color: 'var(--gray-900)' }}>Weekly off</h3>
              <div style={{ fontSize: '0.82rem', color: 'var(--gray-600)' }}>
                School is closed on Sundays — no periods.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Slot list */}
      <div className="card">
        <div className="card-body no-padding">
          {loading ? (
            <div className="spinner-container"><div className="spinner" /></div>
          ) : visibleItems.length === 0 ? (
            <div className="empty-state">
              <FiCalendar size={28} style={{ color: 'var(--gray-300)' }} />
              <h3>{isOffDay ? 'School closed — no periods' : 'No slots on this date'}</h3>
              {!isOffDay && <p>{viewOnly ? 'No periods scheduled.' : 'Add a one-off slot above, or set up a recurring weekly pattern.'}</p>}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {visibleItems.map(it => {
                const meta = PERIOD_BY_KEY[it.period_type] || PERIOD_BY_KEY.OTHER;
                const Icon = meta.icon;
                const editable = !viewOnly && (!readOnlyDisallowed || enabledTypes.includes(it.period_type));
                return (
                  <div key={it.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px', borderBottom: '1px solid var(--gray-100)',
                  }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 8,
                      background: meta.bg, color: meta.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <Icon size={16} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>{it.title}</span>
                        {it.is_one_off ? (
                          <span className="badge" style={{ background: 'var(--warning-50, #fff7ed)', color: 'var(--warning-600, #d97706)', fontSize: '0.65rem' }}>One-off date</span>
                        ) : (
                          <span className="badge badge-neutral" style={{ fontSize: '0.65rem' }}>Recurring every {it.day}</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 12, color: 'var(--gray-500)', fontSize: '0.8rem', marginTop: 2, flexWrap: 'wrap' }}>
                        <span><FiClock size={11} style={{ display: 'inline', marginRight: 3 }} />{it.start_time} – {it.end_time}</span>
                        {it.teacher_name && <span><FiUser size={11} style={{ display: 'inline', marginRight: 3 }} />{it.teacher_name}</span>}
                        {it.notes && <span style={{ fontStyle: 'italic' }}>{it.notes}</span>}
                      </div>
                    </div>
                    {editable && (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn-icon" onClick={() => onEdit(it)} title="Edit"><FiEdit2 size={13} /></button>
                        <button className="btn-icon" onClick={() => onDelete(it)} title="Delete"
                          style={{ color: 'var(--danger-500)' }}><FiTrash2 size={13} /></button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Default export: admin view (loads all sections) ─────────────────────────
export default function AdminTimetable() {
  return <TimetableManager />;
}
