import React, { useEffect, useState } from 'react';
import {
  FiCalendar, FiClock, FiMapPin, FiBook, FiFileText,
  FiAlertCircle, FiChevronDown, FiChevronRight,
} from 'react-icons/fi';
import client from '../../api/client';
import { formatDate } from '../../utils/helpers';

const TYPE_LABEL: Record<string, string> = {
  UNIT_TEST: 'Unit Test', MID_TERM: 'Mid Term', FINAL: 'Final Exam', PRACTICAL: 'Practical', OTHER: 'Other',
};
const TYPE_COLOR: Record<string, string> = {
  UNIT_TEST: '#0ea5e9', MID_TERM: '#f59e0b', FINAL: '#ef4444', PRACTICAL: '#8b5cf6', OTHER: '#6b7280',
};
const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  UPCOMING:  { bg: '#dbeafe', color: '#2563eb' },
  ONGOING:   { bg: '#fef3c7', color: '#d97706' },
  COMPLETED: { bg: '#dcfce7', color: '#16a34a' },
};

/** Coloured grade pill */
function GradeBadge({ grade }: { grade: string }) {
  const colors: Record<string, string> = {
    'A+': '#15803d', A: '#16a34a', 'B+': '#0891b2', B: '#0284c7',
    C: '#7c3aed', D: '#d97706', F: '#dc2626', AB: '#dc2626',
  };
  const c = colors[grade] || '#6b7280';
  return (
    <span style={{
      display: 'inline-block', padding: '1px 8px', borderRadius: 20,
      background: c + '1a', color: c,
      fontSize: '0.72rem', fontWeight: 700, border: `1px solid ${c}30`,
    }}>
      {grade}
    </span>
  );
}

export default function StudentExams() {
  const [exams, setExams]     = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    client.get('/my/exams')
      .then(r => setExams(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const now = Date.now();
  const recentlyAnnounced = exams.filter((e: any) => {
    if (e.status !== 'UPCOMING' || !e.published_at) return false;
    return now - new Date(e.published_at).getTime() < 7 * 24 * 60 * 60 * 1000;
  });

  return (
    <div>
      <div className="page-header"><h1>📝 My Exams</h1></div>

      {/* Newly announced banner */}
      {recentlyAnnounced.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
          border: '1px solid #fbbf24', borderRadius: 'var(--radius-md)',
          padding: '12px 16px', marginBottom: 14,
          display: 'flex', gap: 12, alignItems: 'flex-start',
        }}>
          <div style={{ fontSize: '1.4rem' }}>📢</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: '#92400e', fontSize: '0.95rem' }}>
              {recentlyAnnounced.length === 1
                ? 'New exam announced'
                : `${recentlyAnnounced.length} new exams announced`}
            </div>
            <div style={{ fontSize: '0.82rem', color: '#78350f', marginTop: 4 }}>
              {recentlyAnnounced.map((e: any) => (
                <div key={e.id}>
                  <strong>{e.name}</strong> · starts{' '}
                  {new Date(e.start_date).toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })}
                  {' '}· {e.papers.length} paper{e.papers.length === 1 ? '' : 's'} → Click to see timetable
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="card"><div className="spinner-container"><div className="spinner" /></div></div>
      ) : exams.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <FiFileText size={32} style={{ color: 'var(--gray-300)' }} />
            <h3>No exams scheduled</h3>
            <p>Your exam timetable will appear here</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {exams.map((e: any) => {
            const sb      = STATUS_BADGE[e.status] || STATUS_BADGE.UPCOMING;
            const open    = expanded === e.id;
            const graded  = e.papers.filter((p: any) => p.result_entered);
            const totMax  = graded.reduce((s: number, p: any) => s + (p.max_marks || 0), 0);
            const totGot  = graded.reduce((s: number, p: any) => s + (p.is_absent ? 0 : (p.marks_obtained || 0)), 0);
            const pct     = totMax > 0 ? Math.round((totGot / totMax) * 100) : 0;

            return (
              <div key={e.id} className="card" style={{ overflow: 'hidden' }}>

                {/* ── Exam header ─────────────────────────────────────── */}
                <div
                  style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
                  onClick={() => setExpanded(open ? null : e.id)}
                >
                  {open
                    ? <FiChevronDown  size={15} style={{ color: 'var(--gray-400)', flexShrink: 0 }} />
                    : <FiChevronRight size={15} style={{ color: 'var(--gray-400)', flexShrink: 0 }} />}

                  {/* colour stripe */}
                  <div style={{ width: 4, alignSelf: 'stretch', borderRadius: 4, background: TYPE_COLOR[e.exam_type] || '#888', flexShrink: 0 }} />

                  {/* title block */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700 }}>{e.name}</span>
                      <span className="badge" style={{ background: (TYPE_COLOR[e.exam_type] || '#888') + '20', color: TYPE_COLOR[e.exam_type] || '#888', fontSize: '0.7rem' }}>
                        {TYPE_LABEL[e.exam_type]}
                      </span>
                      <span className="badge" style={{ background: sb.bg, color: sb.color, fontSize: '0.7rem' }}>
                        {e.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--gray-400)', marginTop: 3 }}>
                      <FiCalendar size={11} style={{ verticalAlign: -1 }} />{' '}
                      {formatDate(e.start_date)}{e.end_date && ` – ${formatDate(e.end_date)}`}
                      {' '}· {e.papers.length} paper{e.papers.length === 1 ? '' : 's'}
                    </div>
                  </div>

                  {/* overall score pill */}
                  {graded.length > 0 && (
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '0.65rem', color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Score</div>
                      <div style={{ fontWeight: 800, fontSize: '1.1rem', color: pct >= 33 ? 'var(--success-600)' : 'var(--danger-600)' }}>
                        {pct}%
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Expanded papers ──────────────────────────────────── */}
                {open && (
                  <div style={{ borderTop: '1px solid var(--gray-100)', background: 'var(--gray-50)', padding: '12px 16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

                      {e.papers.map((p: any, i: number) => {
                        const passed = p.result_entered && !p.is_absent && p.marks_obtained >= p.passing_marks;
                        const failed = p.result_entered && !p.is_absent && !passed;
                        const absent = p.result_entered && p.is_absent;

                        const borderColor = passed ? '#86efac' : absent ? '#fca5a5' : failed ? '#fcd34d' : 'var(--gray-200)';
                        const accentColor = passed ? '#16a34a' : absent ? '#dc2626' : failed ? '#d97706' : TYPE_COLOR[e.exam_type] || '#888';

                        return (
                          <div key={i} style={{
                            background: '#fff',
                            border: `1px solid ${borderColor}`,
                            borderLeft: `4px solid ${accentColor}`,
                            borderRadius: 'var(--radius-md)',
                            padding: '10px 14px',
                          }}>

                            {/* Row 1: Subject name LEFT  |  Result RIGHT — they never touch */}
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>

                              {/* Subject */}
                              <div style={{ fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                                <FiBook size={12} style={{ color: 'var(--primary-500)', flexShrink: 0 }} />
                                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {p.subject_name}
                                </span>
                              </div>

                              {/* Result — fixed width on the right, isolated */}
                              <div style={{ flexShrink: 0, textAlign: 'right' }}>
                                {!p.result_entered ? (
                                  <span style={{ fontSize: '0.74rem', color: 'var(--gray-400)', fontStyle: 'italic' }}>
                                    Result pending
                                  </span>
                                ) : absent ? (
                                  <span className="badge" style={{ background: '#fee2e2', color: '#dc2626', fontSize: '0.72rem', padding: '3px 10px' }}>
                                    <FiAlertCircle size={10} style={{ verticalAlign: -1, marginRight: 3 }} />Absent
                                  </span>
                                ) : (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ fontWeight: 800, fontSize: '1rem', color: passed ? 'var(--success-600)' : 'var(--danger-600)' }}>
                                      {p.marks_obtained}
                                      <span style={{ fontWeight: 400, fontSize: '0.74rem', color: 'var(--gray-400)' }}>
                                        /{p.max_marks}
                                      </span>
                                    </span>
                                    {p.grade && <GradeBadge grade={p.grade} />}
                                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: passed ? '#16a34a' : '#dc2626' }}>
                                      {passed ? '✓ Pass' : '✗ Fail'}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Row 2: Schedule metadata */}
                            <div style={{
                              display: 'flex', gap: 14, flexWrap: 'wrap',
                              marginTop: 6, fontSize: '0.76rem', color: 'var(--gray-500)',
                            }}>
                              <span>
                                <FiCalendar size={10} style={{ verticalAlign: -1, marginRight: 3 }} />
                                {formatDate(p.date)}
                              </span>
                              {p.start_time && (
                                <span>
                                  <FiClock size={10} style={{ verticalAlign: -1, marginRight: 3 }} />
                                  {p.start_time}
                                </span>
                              )}
                              {p.duration_minutes && <span>⏱ {p.duration_minutes} min</span>}
                              {p.room && (
                                <span>
                                  <FiMapPin size={10} style={{ verticalAlign: -1, marginRight: 3 }} />
                                  {p.room}
                                </span>
                              )}
                              <span style={{ color: 'var(--gray-400)' }}>
                                Max: {p.max_marks} · Pass: {p.passing_marks}
                              </span>
                            </div>

                            {/* Row 3: Syllabus — full width, labelled, completely separate from Result */}
                            {p.syllabus && (
                              <div style={{
                                marginTop: 8,
                                padding: '7px 10px',
                                background: '#f8fafc',
                                border: '1px solid var(--gray-100)',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: '0.77rem',
                                color: 'var(--gray-600)',
                                lineHeight: 1.6,
                              }}>
                                <span style={{ fontWeight: 600, color: 'var(--gray-700)', marginRight: 6 }}>
                                  📖 Syllabus:
                                </span>
                                {p.syllabus}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Overall score summary bar — only for completed exams with results */}
                    {e.status === 'COMPLETED' && graded.length > 0 && (
                      <div style={{
                        marginTop: 12, padding: '10px 14px',
                        background: pct >= 33
                          ? 'linear-gradient(135deg, #dcfce7, #bbf7d0)'
                          : 'linear-gradient(135deg, #fee2e2, #fecaca)',
                        border: `1px solid ${pct >= 33 ? '#86efac' : '#fca5a5'}`,
                        borderRadius: 'var(--radius-md)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                      }}>
                        <div>
                          <div style={{ fontWeight: 700, color: pct >= 33 ? '#15803d' : '#dc2626', fontSize: '0.9rem' }}>
                            {pct >= 33 ? '🎉 Passed' : '😔 Not Passed'} — Overall Score
                          </div>
                          <div style={{ fontSize: '0.78rem', color: pct >= 33 ? '#166534' : '#991b1b', marginTop: 2 }}>
                            {totGot} out of {totMax} marks · {graded.length} of {e.papers.length} result{e.papers.length === 1 ? '' : 's'} entered
                          </div>
                        </div>
                        <div style={{ fontWeight: 900, fontSize: '1.6rem', color: pct >= 33 ? '#15803d' : '#dc2626' }}>
                          {pct}%
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
