import React, { useEffect, useMemo, useState } from 'react';
import {
  FiChevronDown, FiChevronUp, FiSave, FiX, FiUser, FiBook, FiCheckCircle,
} from 'react-icons/fi';
import client from '../api/client';
import { toast } from '../utils/toast';
import { getInitials } from '../utils/helpers';

interface Teacher {
  id: string;
  first_name?: string;
  last_name?: string;
  subject_ids?: string[];
  employee_id?: string;
}

interface RosterRow {
  subject_id: string;
  subject_name: string;
  subject_code?: string | null;
  teacher_id: string | null;
  teacher_name: string | null;
  teacher_employee_id: string | null;
}

interface Props {
  sectionId: string;
  sectionName: string;
  className: string;
  /** All teachers in the school — used to populate per-row dropdowns. */
  teachers: Teacher[];
}

/**
 * Inline expander shown under each section card. Lists every subject of the
 * parent class with a teacher picker. Teachers qualified for the subject (per
 * their `subject_ids_json`) are listed first; the rest are shown below a divider
 * so admins aren't blocked when their teacher list is partly wrong.
 */
export default function SectionRosterPanel({
  sectionId, sectionName, className, teachers,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<RosterRow[]>([]);
  /** Working state — keyed by subject_id → current chosen teacher_id (or ''). */
  const [draft, setDraft] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    try {
      const r = await client.get(`/class-roster/section/${sectionId}`);
      const list: RosterRow[] = r.data?.rows || [];
      setRows(list);
      setDraft(Object.fromEntries(list.map(row => [row.subject_id, row.teacher_id || ''])));
    } catch {
      setRows([]);
      setDraft({});
    } finally {
      setLoading(false);
    }
  };

  // Lazy-load: don't pull until the panel is opened the first time.
  useEffect(() => {
    if (open && rows.length === 0 && !loading) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const dirty = useMemo(() => {
    return rows.some(r => (r.teacher_id || '') !== (draft[r.subject_id] || ''));
  }, [rows, draft]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const assignments = rows.map(r => ({
        subject_id: r.subject_id,
        teacher_id: draft[r.subject_id] || null,
      }));
      const resp = await client.put(`/class-roster/section/${sectionId}`, { assignments });
      const fresh: RosterRow[] = resp.data?.rows || [];
      setRows(fresh);
      setDraft(Object.fromEntries(fresh.map(row => [row.subject_id, row.teacher_id || ''])));
      toast.success(`Subject teachers saved for ${className} · Section ${sectionName}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to save subject teachers');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setDraft(Object.fromEntries(rows.map(r => [r.subject_id, r.teacher_id || ''])));
  };

  // Per-row teacher options: split into "qualified" vs "other" so admins can
  // see who's set up correctly without losing access to the long tail.
  const optionsFor = (subjectId: string) => {
    const qualified: Teacher[] = [];
    const others: Teacher[] = [];
    teachers.forEach(t => {
      if (Array.isArray(t.subject_ids) && t.subject_ids.includes(subjectId)) {
        qualified.push(t);
      } else {
        others.push(t);
      }
    });
    return { qualified, others };
  };

  const filledCount = rows.filter(r => !!draft[r.subject_id]).length;

  return (
    <div style={{
      width: '100%',
      marginTop: 8,
      borderTop: '1px dashed var(--gray-200)',
      paddingTop: 8,
    }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'transparent', border: 'none', cursor: 'pointer',
          padding: '4px 4px', color: 'var(--primary-700, #4338ca)',
          fontSize: '0.82rem', fontWeight: 700,
        }}
      >
        <FiBook size={13} />
        Subject teachers
        {rows.length > 0 && (
          <span style={{
            background: 'var(--primary-50, #eef2ff)', color: 'var(--primary-700, #4338ca)',
            padding: '1px 8px', borderRadius: 'var(--radius-full, 999px)',
            fontSize: '0.7rem', fontWeight: 700,
          }}>
            {filledCount} / {rows.length}
          </span>
        )}
        {open ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
      </button>

      {open && (
        <div style={{
          marginTop: 8, padding: '10px 12px',
          background: 'var(--gray-50, #f9fafb)',
          border: '1px solid var(--gray-200)',
          borderRadius: 'var(--radius-md, 8px)',
        }}>
          {loading ? (
            <div className="spinner-container" style={{ padding: 14 }}><div className="spinner" /></div>
          ) : rows.length === 0 ? (
            <div style={{ fontSize: '0.82rem', color: 'var(--gray-500)' }}>
              No subjects on this class yet. Add subjects first; they will then appear here for teacher assignment.
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {rows.map(r => {
                  const { qualified, others } = optionsFor(r.subject_id);
                  const value = draft[r.subject_id] || '';
                  return (
                    <div key={r.subject_id} style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(120px, 1fr) 2fr auto',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 8px',
                      background: '#fff',
                      border: '1px solid var(--gray-200)',
                      borderRadius: 'var(--radius-md, 8px)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <FiBook size={12} style={{ color: 'var(--gray-400)', flexShrink: 0 }} />
                        <div style={{
                          fontSize: '0.85rem', fontWeight: 600, color: 'var(--gray-800)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {r.subject_name}{r.subject_code ? ` (${r.subject_code})` : ''}
                        </div>
                      </div>
                      <select
                        value={value}
                        onChange={e => setDraft(d => ({ ...d, [r.subject_id]: e.target.value }))}
                        style={{
                          padding: '5px 8px', fontSize: '0.83rem',
                          border: '1px solid var(--gray-300)', borderRadius: 6, background: '#fff',
                        }}
                      >
                        <option value="">— Unassigned —</option>
                        {qualified.length > 0 && (
                          <optgroup label="Qualified for this subject">
                            {qualified.map(t => (
                              <option key={t.id} value={t.id}>
                                {`${t.first_name || ''} ${t.last_name || ''}`.trim()}
                                {t.employee_id ? ` · ${t.employee_id}` : ''}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {others.length > 0 && (
                          <optgroup label={qualified.length > 0 ? 'Other teachers' : 'All teachers'}>
                            {others.map(t => (
                              <option key={t.id} value={t.id}>
                                {`${t.first_name || ''} ${t.last_name || ''}`.trim()}
                                {t.employee_id ? ` · ${t.employee_id}` : ''}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                      {value ? (
                        (() => {
                          const t = teachers.find(tt => tt.id === value);
                          const initials = getInitials(`${t?.first_name || ''} ${t?.last_name || ''}`);
                          return (
                            <div className="avatar" style={{
                              width: 26, height: 26, fontSize: '0.62rem',
                              background: 'var(--success-500, #10b981)',
                            }} title={`${t?.first_name || ''} ${t?.last_name || ''}`.trim()}>
                              {initials}
                            </div>
                          );
                        })()
                      ) : (
                        <FiUser size={14} style={{ color: 'var(--gray-300)' }} />
                      )}
                    </div>
                  );
                })}
              </div>

              <div style={{
                display: 'flex', justifyContent: 'flex-end', gap: 8,
                marginTop: 10, paddingTop: 10,
                borderTop: '1px dashed var(--gray-200)',
              }}>
                {dirty && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ width: 'auto' }}
                    onClick={handleReset}
                    disabled={saving}
                  >
                    <FiX /> Revert
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ width: 'auto', minWidth: 110 }}
                  onClick={handleSave}
                  disabled={!dirty || saving}
                >
                  {saving
                    ? <>Saving…</>
                    : dirty
                      ? <><FiSave /> Save changes</>
                      : <><FiCheckCircle /> Saved</>
                  }
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
