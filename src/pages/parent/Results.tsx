import React, { useState, useEffect, useMemo } from 'react';
import {
  FiCalendar, FiAward, FiBookOpen, FiChevronRight, FiX, FiTrendingUp, FiUsers,
} from 'react-icons/fi';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from 'recharts';
import client from '../../api/client';
import { getInitials } from '../../utils/helpers';

interface Child {
  student_id: string;
  first_name: string;
  last_name: string;
  admission_no: string;
  class_name: string | null;
  section_name: string | null;
}

const GRADE_COLOR: Record<string, string> = {
  'A+': '#059669', A: '#10b981', 'B+': '#3b82f6', B: '#0ea5e9',
  C: '#f59e0b', D: '#f97316', F: '#dc2626', AB: '#6b7280',
};

export default function ParentResults() {
  const [children, setChildren] = useState<Child[]>([]);
  const [childId, setChildId] = useState('');
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openExam, setOpenExam] = useState<any>(null);

  // Load children
  useEffect(() => {
    client.get('/parent/children')
      .then(r => {
        const kids: Child[] = Array.isArray(r.data) ? r.data : [];
        setChildren(kids);
        if (kids.length === 1) setChildId(kids[0].student_id);
        else if (kids.length === 0) setError('No children linked to your account yet.');
      })
      .catch(() => setError('Failed to load children.'))
      .finally(() => setLoading(false));
  }, []);

  // Load exams when child changes
  useEffect(() => {
    if (!childId) { setExams([]); return; }
    client.get(`/parent/child/${childId}/exam-results`)
      .then(r => setExams(Array.isArray(r.data) ? r.data : []))
      .catch(() => setExams([]));
  }, [childId]);

  const activeChild = useMemo(() => children.find(c => c.student_id === childId), [children, childId]);

  const trend = useMemo(() => {
    return [...exams].sort((a, b) => a.start_date.localeCompare(b.start_date)).map(e => ({
      exam: e.exam_name.length > 14 ? e.exam_name.slice(0, 13) + '…' : e.exam_name,
      percentage: e.my.percentage,
      classAvg: e.stats.average_percentage,
    }));
  }, [exams]);

  if (loading) return <div className="card"><div className="spinner-container"><div className="spinner" /></div></div>;
  if (error) {
    return (
      <div>
        <div className="page-header"><h1>📊 Child Results</h1></div>
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
          <h1>📊 Child Results</h1>
          <p style={{ color: 'var(--gray-400)', fontSize: '0.85rem', margin: '4px 0 0' }}>
            See your child's exam results, class rank, subject breakdown and performance trend.
          </p>
        </div>
      </div>

      {/* Child picker */}
      {children.length > 1 && (
        <div className="card" style={{ marginBottom: '0.75rem' }}>
          <div className="card-body" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {children.map(c => {
              const active = c.student_id === childId;
              return (
                <button key={c.student_id} onClick={() => setChildId(c.student_id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 14px', borderRadius: 'var(--radius-md)',
                    border: `1.5px solid ${active ? 'var(--primary-500)' : 'var(--gray-200)'}`,
                    background: active ? 'var(--primary-50)' : '#fff',
                    cursor: 'pointer', fontWeight: 600,
                  }}>
                  <div className="avatar" style={{ width: 28, height: 28, fontSize: '0.7rem', background: active ? 'var(--primary-500)' : 'var(--gray-300)' }}>
                    {getInitials(`${c.first_name} ${c.last_name}`)}
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '0.86rem' }}>{c.first_name} {c.last_name}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--gray-400)' }}>
                      {c.class_name}{c.section_name ? ` · ${c.section_name}` : ''}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!childId ? (
        <div className="card"><div className="empty-state"><h3>Select a child</h3></div></div>
      ) : exams.length === 0 ? (
        <div className="card"><div className="empty-state">
          <FiBookOpen size={32} style={{ color: 'var(--gray-300)' }} />
          <h3>No results yet</h3>
          <p>Your child's exam results will appear here once the school publishes them.</p>
        </div></div>
      ) : (
        <>
          {trend.length > 1 && (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div className="card-header">
                <h3 style={{ margin: 0, fontSize: '0.95rem' }}>
                  <FiTrendingUp style={{ display: 'inline', marginRight: 6 }} /> Performance Trend
                </h3>
              </div>
              <div className="card-body">
                <div style={{ width: '100%', height: 220 }}>
                  <ResponsiveContainer>
                    <LineChart data={trend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                      <XAxis dataKey="exam" tick={{ fontSize: 11, fill: 'var(--gray-500)' }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--gray-500)' }} unit="%" />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="percentage" name={activeChild?.first_name || 'Child'} stroke="#6366f1" strokeWidth={3} dot={{ r: 5 }} />
                      <Line type="monotone" dataKey="classAvg" name="Class avg" stroke="#94a3b8" strokeWidth={2} strokeDasharray="4 4" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gap: 12 }}>
            {exams.map(e => {
              const me = e.my;
              const gradeColor = GRADE_COLOR[me.grade] || 'var(--gray-500)';
              const medal = me.rank === 1 ? '🥇' : me.rank === 2 ? '🥈' : me.rank === 3 ? '🥉' : null;
              return (
                <button key={e.exam_id} onClick={() => setOpenExam(e)}
                  className="card"
                  style={{
                    textAlign: 'left', cursor: 'pointer', border: 'none', padding: 0,
                    borderLeft: `5px solid ${gradeColor}`,
                  }}>
                  <div style={{ padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                          <span className="badge badge-neutral" style={{ fontSize: '0.65rem' }}>{e.exam_type.replace('_', ' ')}</span>
                          {me.result === 'PASS' && <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>PASS</span>}
                          {me.result === 'FAIL' && <span className="badge badge-danger" style={{ fontSize: '0.65rem' }}>FAIL</span>}
                        </div>
                        <h3 style={{ margin: '4px 0 4px', fontSize: '1.1rem' }}>{e.exam_name}</h3>
                        <div style={{ fontSize: '0.78rem', color: 'var(--gray-500)' }}>
                          <FiCalendar size={11} style={{ display: 'inline', marginRight: 4 }} />
                          {e.start_date} · {e.papers_count} paper{e.papers_count === 1 ? '' : 's'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                        <div style={{ textAlign: 'center', minWidth: 80 }}>
                          <div style={{ fontSize: '0.62rem', color: 'var(--gray-500)', fontWeight: 700 }}>CLASS RANK</div>
                          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: gradeColor }}>
                            {medal || ''} #{me.rank}<span style={{ fontSize: '0.78rem', color: 'var(--gray-400)' }}>/{e.stats.appeared}</span>
                          </div>
                        </div>
                        <div style={{ textAlign: 'center', minWidth: 80 }}>
                          <div style={{ fontSize: '0.62rem', color: 'var(--gray-500)', fontWeight: 700 }}>SCORE</div>
                          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: gradeColor }}>{me.percentage}%</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)' }}>{me.total_obtained}/{me.total_max}</div>
                        </div>
                        <div style={{ textAlign: 'center', minWidth: 60 }}>
                          <div style={{ fontSize: '0.62rem', color: 'var(--gray-500)', fontWeight: 700 }}>GRADE</div>
                          <div style={{
                            fontSize: '1.6rem', fontWeight: 800, color: gradeColor,
                            padding: '2px 12px', borderRadius: 'var(--radius-md)',
                            background: gradeColor + '15', display: 'inline-block', marginTop: 2,
                          }}>{me.grade}</div>
                        </div>
                        <FiChevronRight size={20} style={{ color: 'var(--gray-300)' }} />
                      </div>
                    </div>
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed var(--gray-100)', display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--gray-500)' }}>
                      <span>Class avg: <strong>{e.stats.average_percentage}%</strong></span>
                      <span>Top: <strong>{e.stats.top_percentage}%</strong></span>
                      <span>{e.stats.appeared} appeared / {e.stats.total_students} total</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Report modal */}
      {openExam && (
        <div className="modal-overlay" onClick={() => setOpenExam(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 760 }}>
            <div className="modal-header">
              <h3>📜 Report Card</h3>
              <button className="modal-close" onClick={() => setOpenExam(null)}><FiX /></button>
            </div>
            <div className="modal-body">
              <ReportCardModalContent exam={openExam} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReportCardModalContent({ exam }: { exam: any }) {
  const me = exam.my;
  const gradeColor = GRADE_COLOR[me.grade] || 'var(--gray-500)';
  const medal = me.rank === 1 ? '🥇' : me.rank === 2 ? '🥈' : me.rank === 3 ? '🥉' : null;
  const chartData = (me.subjects || []).map((s: any) => ({
    subject: s.subject_name.length > 12 ? s.subject_name.slice(0, 11) + '…' : s.subject_name,
    obtained: s.is_absent ? 0 : (s.marks_obtained ?? 0),
    max: s.max_marks,
  }));

  return (
    <div>
      <div style={{
        padding: 18, marginBottom: 14,
        background: `linear-gradient(135deg, ${gradeColor}15 0%, #fff 60%)`,
        borderRadius: 'var(--radius-md)',
        border: `1.5px solid ${gradeColor}30`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: gradeColor, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              {exam.exam_type.replace('_', ' ')}
            </div>
            <h2 style={{ margin: '4px 0', fontSize: '1.4rem' }}>{exam.exam_name}</h2>
            <div style={{ fontSize: '0.82rem', color: 'var(--gray-500)' }}>{me.name} · {me.admission_no}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.62rem', color: 'var(--gray-500)', fontWeight: 700 }}>RANK</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: gradeColor, lineHeight: 1 }}>{medal || ''}#{me.rank}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)' }}>of {exam.stats.appeared}</div>
            </div>
            <div style={{ width: 1, height: 50, background: 'var(--gray-200)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.62rem', color: 'var(--gray-500)', fontWeight: 700 }}>SCORE</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: gradeColor, lineHeight: 1 }}>{me.percentage}%</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)' }}>{me.total_obtained}/{me.total_max}</div>
            </div>
            <div style={{ width: 1, height: 50, background: 'var(--gray-200)' }} />
            <div style={{
              padding: '8px 16px', borderRadius: 'var(--radius-md)',
              background: gradeColor, color: '#fff', textAlign: 'center',
            }}>
              <div style={{ fontSize: '0.62rem', fontWeight: 700, opacity: 0.85 }}>GRADE</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, lineHeight: 1 }}>{me.grade}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-header"><h3 style={{ margin: 0, fontSize: '0.95rem' }}>Subject Breakdown</h3></div>
        <div className="card-body no-padding">
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead><tr><th>Subject</th><th>Marks</th><th>Max</th><th>Grade</th><th>%</th><th>Status</th></tr></thead>
              <tbody>
                {(me.subjects || []).map((s: any) => {
                  const pct = s.max_marks && !s.is_absent && s.marks_obtained != null ? Math.round((s.marks_obtained / s.max_marks) * 100) : 0;
                  return (
                    <tr key={s.paper_id}>
                      <td style={{ fontWeight: 600 }}>{s.subject_name}</td>
                      <td>{s.is_absent ? '—' : (s.marks_obtained ?? '—')}</td>
                      <td style={{ color: 'var(--gray-500)' }}>{s.max_marks}</td>
                      <td>
                        {s.grade ? (
                          <span style={{
                            padding: '3px 8px', borderRadius: 'var(--radius-full)', fontSize: '0.72rem', fontWeight: 800,
                            background: (GRADE_COLOR[s.grade] || '#999') + '20', color: GRADE_COLOR[s.grade] || '#999',
                          }}>{s.grade}</span>
                        ) : '—'}
                      </td>
                      <td>
                        {!s.is_absent && s.marks_obtained != null ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 90 }}>
                            <div style={{ flex: 1, background: 'var(--gray-100)', borderRadius: 4, height: 5 }}>
                              <div style={{
                                width: `${pct}%`,
                                background: s.passed ? 'var(--success-500)' : 'var(--danger-500)',
                                height: '100%', borderRadius: 4,
                              }} />
                            </div>
                            <span style={{ fontSize: '0.76rem', fontWeight: 700, color: s.passed ? 'var(--success-600)' : 'var(--danger-600)' }}>{pct}%</span>
                          </div>
                        ) : '—'}
                      </td>
                      <td>
                        {s.is_absent
                          ? <span className="badge" style={{ background: '#374151', color: '#fff', fontSize: '0.65rem' }}>ABSENT</span>
                          : s.passed
                            ? <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>PASS</span>
                            : <span className="badge badge-danger" style={{ fontSize: '0.65rem' }}>FAIL</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--gray-200)', background: 'var(--gray-50)' }}>
                  <td style={{ fontWeight: 800 }}>TOTAL</td>
                  <td style={{ fontWeight: 800 }}>{me.total_obtained}</td>
                  <td style={{ color: 'var(--gray-500)', fontWeight: 700 }}>{me.total_max}</td>
                  <td>
                    <span style={{
                      padding: '4px 10px', borderRadius: 'var(--radius-full)', fontSize: '0.78rem', fontWeight: 800,
                      background: gradeColor + '20', color: gradeColor,
                    }}>{me.grade}</span>
                  </td>
                  <td style={{ fontWeight: 800, color: gradeColor }}>{me.percentage}%</td>
                  <td>
                    {me.result === 'PASS' ? <span className="badge badge-success">PASS</span> : <span className="badge badge-danger">FAIL</span>}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {chartData.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-header"><h3 style={{ margin: 0, fontSize: '0.95rem' }}>📈 Subject Performance</h3></div>
          <div className="card-body">
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                  <XAxis dataKey="subject" tick={{ fontSize: 11, fill: 'var(--gray-500)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--gray-500)' }} />
                  <Tooltip />
                  <Bar dataKey="obtained" fill={gradeColor} radius={[6, 6, 0, 0]} />
                  <Bar dataKey="max" fill="var(--gray-200)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {exam.top3 && exam.top3.length > 0 && (
        <div className="card">
          <div className="card-header"><h3 style={{ margin: 0, fontSize: '0.95rem' }}>🏆 Top of class</h3></div>
          <div className="card-body" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {exam.top3.map((t: any) => {
              const medalEmoji = t.rank === 1 ? '🥇' : t.rank === 2 ? '🥈' : '🥉';
              const isChild = t.student_id === me.student_id;
              return (
                <div key={t.student_id} style={{
                  flex: '1 1 200px', padding: 12, borderRadius: 'var(--radius-md)',
                  background: isChild ? 'var(--primary-50)' : 'var(--gray-50)',
                  border: isChild ? '1.5px solid var(--primary-500)' : '1px solid var(--gray-200)',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <div style={{ fontSize: '1.6rem' }}>{medalEmoji}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>
                      {t.name}{isChild && <span style={{ marginLeft: 6, background: 'var(--primary-500)', color: '#fff', fontSize: '0.6rem', padding: '1px 5px', borderRadius: 8, fontWeight: 700 }}>CHILD</span>}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--gray-500)' }}>{t.percentage}% · {t.grade}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
