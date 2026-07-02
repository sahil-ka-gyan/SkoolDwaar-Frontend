import React, { useEffect, useMemo, useState } from 'react';
import {
  FiX, FiAward, FiUsers, FiCheckCircle, FiAlertCircle, FiUserX,
  FiTrendingUp, FiDownload, FiSearch, FiBookOpen,
} from 'react-icons/fi';
import client from '../api/client';
import { getInitials } from '../utils/helpers';

interface Props {
  examId: string;
  onClose?: () => void;
  /** Hide outer modal chrome — render inline. */
  inline?: boolean;
}

const GRADE_COLOR: Record<string, string> = {
  'A+': '#059669', A: '#10b981', 'B+': '#3b82f6', B: '#0ea5e9',
  C: '#f59e0b', D: '#f97316', F: '#dc2626',
};

export default function ExamRankings({ examId, onClose, inline }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!examId) return;
    setLoading(true);
    client.get(`/exams/${examId}/rankings`)
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [examId]);

  const exam = data?.exam;
  const stats = data?.stats;
  const rankings: any[] = data?.rankings || [];

  const top3 = useMemo(() => rankings.filter(r => r.rank && r.rank <= 3).sort((a, b) => a.rank - b.rank), [rankings]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rankings;
    const q = search.toLowerCase();
    return rankings.filter(r =>
      `${r.name} ${r.admission_no} ${r.roll_no || ''} ${r.section_name || ''}`.toLowerCase().includes(q));
  }, [rankings, search]);

  const exportCSV = () => {
    if (!data) return;
    const papers = data.papers || [];
    const headers = ['Rank', 'Name', 'Admission No', 'Roll No', 'Section',
      ...papers.map((p: any) => `${p.subject_name} (/${p.max_marks})`),
      'Total Obtained', 'Total Max', 'Percentage', 'Grade', 'Result'];
    const rows = rankings.map(r => [
      r.rank ?? '—',
      r.name,
      r.admission_no,
      r.roll_no || '',
      r.section_name || '',
      ...papers.map((p: any) => {
        const s = (r.subjects || []).find((x: any) => x.paper_id === p.id);
        if (!s) return '—';
        if (s.is_absent) return 'AB';
        return s.marks_obtained != null ? s.marks_obtained : '—';
      }),
      r.total_obtained,
      r.total_max,
      r.percentage + '%',
      r.grade || '—',
      r.result,
    ]);
    const csv = [headers, ...rows].map((row: any[]) => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exam?.name || 'exam'}-rankings.csv`.replace(/\s+/g, '-');
    a.click();
    URL.revokeObjectURL(url);
  };

  const topperEntry = top3.find(t => t.rank === 1);

  const body = (
    <>
      {loading ? (
        <div className="spinner-container"><div className="spinner" /></div>
      ) : !data || !exam ? (
        <div className="empty-state">
          <FiAlertCircle size={28} style={{ color: 'var(--gray-300)' }} />
          <h3>Could not load rankings</h3>
        </div>
      ) : (
        <>
          {/* ─── Hero header ─── */}
          <div style={{
            padding: '16px 18px', marginBottom: 14,
            background: 'linear-gradient(135deg, #eef2ff 0%, #f8fafc 100%)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--gray-200)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--primary-600)', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                  {exam.exam_type.replace('_', ' ')}{data?.exam?.is_result_announced !== false ? ' · Result Announced' : ' · Draft'}
                </div>
                <h2 style={{ margin: '4px 0 4px', fontSize: '1.25rem' }}>{exam.name}</h2>
                <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>
                  {exam.start_date}{exam.end_date ? ` → ${exam.end_date}` : ''} · Total marks {data.total_max}
                </div>
              </div>
              <button className="btn btn-secondary btn-sm" style={{ width: 'auto' }} onClick={exportCSV} disabled={rankings.length === 0}>
                <FiDownload size={13} /> Export CSV
              </button>
            </div>
          </div>

          {/* ─── Compact stats strip ─── */}
          {stats && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: 8, marginBottom: 14,
            }}>
              <MiniStat icon={<FiUsers size={14} />} label="Students" value={stats.total_students} color="#6366f1" />
              <MiniStat icon={<FiCheckCircle size={14} />} label="Appeared" value={stats.appeared} color="#10b981" />
              <MiniStat icon={<FiAward size={14} />} label="Passed" value={stats.pass_count} color="#16a34a" />
              <MiniStat icon={<FiAlertCircle size={14} />} label="Failed" value={stats.fail_count} color="#ef4444" />
              <MiniStat icon={<FiTrendingUp size={14} />} label="Class Avg" value={`${stats.average_percentage}%`} color="#8b5cf6" />
              <MiniStat
                icon={<FiAward size={14} />}
                label="Topper"
                value={topperEntry ? `${topperEntry.name.split(' ')[0]} — ${stats.top_percentage}%` : `${stats.top_percentage}%`}
                color="#f59e0b"
                wide
              />
            </div>
          )}

          {/* ─── Podium (works with 2+ toppers) ─── */}
          {top3.length >= 2 && (
            <div style={{
              marginBottom: 14, padding: '16px 12px',
              background: 'linear-gradient(135deg, #fefce8 0%, #fff7ed 50%, #fdf2f8 100%)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid #fde68a',
            }}>
              <div style={{ textAlign: 'center', marginBottom: 10, fontSize: '0.78rem', fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                🏆 Top Performers
              </div>
              <div style={{
                display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 10, flexWrap: 'wrap',
              }}>
                {/* Silver (rank 2) — left */}
                {top3.find(t => t.rank === 2) && (
                  <PodiumCard rank={2} entry={top3.find(t => t.rank === 2)!} height={110} />
                )}
                {/* Gold (rank 1) — center, tallest */}
                {top3.find(t => t.rank === 1) && (
                  <PodiumCard rank={1} entry={top3.find(t => t.rank === 1)!} height={140} />
                )}
                {/* Bronze (rank 3) — right */}
                {top3.find(t => t.rank === 3) && (
                  <PodiumCard rank={3} entry={top3.find(t => t.rank === 3)!} height={95} />
                )}
              </div>
            </div>
          )}

          {/* ─── Search bar ─── */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
            marginBottom: 10, padding: '8px 12px',
            background: '#fff', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--gray-200)',
          }}>
            <div style={{ position: 'relative', minWidth: 220, flex: 1 }}>
              <FiSearch style={{ position: 'absolute', left: '.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', pointerEvents: 'none' }} />
              <input type="text" placeholder="Search by name, roll, admission, section…" value={search} onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: '2rem', width: '100%', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-sm)', padding: '6px 8px 6px 2rem', fontSize: '0.84rem' }} />
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--gray-400)', whiteSpace: 'nowrap' }}>
              {filtered.length} of {rankings.length} student{rankings.length === 1 ? '' : 's'}
            </span>
          </div>

          {/* ─── Rankings table ─── */}
          <div className="card">
            <div className="card-body no-padding">
              {filtered.length === 0 ? (
                <div className="empty-state">
                  <FiBookOpen size={28} style={{ color: 'var(--gray-300)' }} />
                  <h3>No rankings to show</h3>
                  <p>Marks haven't been entered yet for this exam.</p>
                </div>
              ) : (
                <div className="data-table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: 65 }}>Rank</th>
                        <th>Student</th>
                        <th style={{ width: 70 }}>Section</th>
                        {(data.papers || []).map((p: any) => (
                          <th key={p.id} title={p.subject_name} style={{ textAlign: 'center', minWidth: 55 }}>
                            {p.subject_name.length > 8 ? p.subject_name.slice(0, 7) + '…' : p.subject_name}
                            <div style={{ fontSize: '0.6rem', color: 'var(--gray-400)', fontWeight: 500 }}>/ {p.max_marks}</div>
                          </th>
                        ))}
                        <th style={{ textAlign: 'right', minWidth: 70 }}>Total</th>
                        <th style={{ minWidth: 85 }}>%</th>
                        <th style={{ width: 55 }}>Grade</th>
                        <th style={{ width: 60 }}>Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((r) => {
                        const medalEmoji = r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : null;
                        const gradeColor = GRADE_COLOR[r.grade] || 'var(--gray-500)';
                        return (
                          <tr key={r.student_id} style={{ background: r.rank && r.rank <= 3 ? '#fffbeb' : undefined }}>
                            <td style={{ fontWeight: 800, fontSize: '0.88rem' }}>
                              {r.rank ? (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                  {medalEmoji && <span style={{ fontSize: '1rem' }}>{medalEmoji}</span>}
                                  <span>#{r.rank}</span>
                                </span>
                              ) : <span style={{ color: 'var(--gray-300)' }}>—</span>}
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div className="avatar" style={{ width: 28, height: 28, fontSize: '0.65rem', background: r.rank === 1 ? '#f59e0b' : r.rank === 2 ? '#94a3b8' : r.rank === 3 ? '#d97706' : '#6366f1', flexShrink: 0 }}>
                                  {getInitials(r.name)}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontWeight: 700, fontSize: '0.84rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
                                  <div style={{ fontSize: '0.68rem', color: 'var(--gray-400)' }}>{r.admission_no}{r.roll_no ? ` · Roll ${r.roll_no}` : ''}</div>
                                </div>
                              </div>
                            </td>
                            <td>
                              {r.section_name ? <span className="badge badge-neutral" style={{ fontSize: '0.68rem' }}>{r.section_name}</span> : '—'}
                            </td>
                            {(data.papers || []).map((p: any) => {
                              const s = (r.subjects || []).find((x: any) => x.paper_id === p.id);
                              if (!s || !s.entered) return <td key={p.id} style={{ textAlign: 'center', color: 'var(--gray-300)', fontSize: '0.82rem' }}>—</td>;
                              if (s.is_absent) return <td key={p.id} style={{ textAlign: 'center' }}><span className="badge" style={{ background: '#374151', color: '#fff', fontSize: '0.6rem', padding: '2px 6px' }}>AB</span></td>;
                              const passed = s.passed;
                              return (
                                <td key={p.id} style={{ textAlign: 'center', fontWeight: 700, fontSize: '0.88rem', color: passed ? 'var(--gray-800)' : 'var(--danger-600, #dc2626)' }}>
                                  {s.marks_obtained}
                                </td>
                              );
                            })}
                            <td style={{ textAlign: 'right', fontWeight: 800, fontSize: '0.88rem' }}>
                              {r.total_obtained}<span style={{ color: 'var(--gray-400)', fontWeight: 400, fontSize: '0.72rem' }}>/{r.total_max}</span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 80 }}>
                                <div style={{ flex: 1, background: 'var(--gray-100)', borderRadius: 3, height: 4 }}>
                                  <div style={{
                                    width: `${Math.min(100, r.percentage)}%`,
                                    background: gradeColor, height: '100%', borderRadius: 3,
                                  }} />
                                </div>
                                <span style={{ fontSize: '0.76rem', fontWeight: 700, color: gradeColor, whiteSpace: 'nowrap' }}>{r.percentage}%</span>
                              </div>
                            </td>
                            <td>
                              {r.grade ? (
                                <span style={{
                                  padding: '2px 7px', borderRadius: 'var(--radius-full)', fontSize: '0.7rem', fontWeight: 800,
                                  background: gradeColor + '20', color: gradeColor,
                                }}>{r.grade}</span>
                              ) : '—'}
                            </td>
                            <td>
                              {r.result === 'PASS' ? <span className="badge badge-success" style={{ fontSize: '0.62rem', padding: '2px 6px' }}>PASS</span>
                                : r.result === 'FAIL' ? <span className="badge badge-danger" style={{ fontSize: '0.62rem', padding: '2px 6px' }}>FAIL</span>
                                : <span className="badge badge-warning" style={{ fontSize: '0.62rem', padding: '2px 6px' }}>awaiting</span>}
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
        </>
      )}
    </>
  );

  if (inline) return body;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 1050, width: '95vw' }}>
        <div className="modal-header">
          <h3>📊 Class Rankings & Marks</h3>
          {onClose && <button className="modal-close" onClick={onClose}><FiX /></button>}
        </div>
        <div className="modal-body" style={{ maxHeight: '78vh', overflowY: 'auto' }}>{body}</div>
      </div>
    </div>
  );
}

/* ─── Compact stat tile ─── */
function MiniStat({ icon, label, value, color, wide }: { icon: React.ReactNode; label: string; value: any; color: string; wide?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 12px',
      background: '#fff',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--gray-200)',
      gridColumn: wide ? 'span 2' : undefined,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: color + '15', color: color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: 0.3, lineHeight: 1 }}>{label}</div>
        <div style={{
          fontSize: '0.92rem', fontWeight: 800, color: 'var(--gray-800)', lineHeight: 1.3,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{value}</div>
      </div>
    </div>
  );
}

/* ─── Podium card ─── */
function PodiumCard({ rank, entry, height }: { rank: number; entry: any; height: number }) {
  if (!entry) return null;
  const bg = rank === 1
    ? 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)'
    : rank === 2
      ? 'linear-gradient(135deg, #d4d4d8 0%, #a1a1aa 100%)'
      : 'linear-gradient(135deg, #d97706 0%, #92400e 100%)';
  const emoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉';
  return (
    <div style={{
      width: 150, padding: '10px 8px', borderRadius: 'var(--radius-md)',
      background: bg, color: '#fff',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end',
      minHeight: height,
      boxShadow: rank === 1 ? '0 6px 20px rgba(245, 158, 11, 0.35)' : '0 3px 10px rgba(0,0,0,0.12)',
    }}>
      <div style={{ fontSize: rank === 1 ? '2rem' : '1.5rem', marginBottom: 4, lineHeight: 1 }}>{emoji}</div>
      <div className="avatar" style={{
        width: 36, height: 36, fontSize: '0.78rem',
        background: 'rgba(255,255,255,0.3)', color: '#fff',
        border: '2px solid rgba(255,255,255,0.7)', marginBottom: 5,
      }}>
        {getInitials(entry.name)}
      </div>
      <div style={{ fontWeight: 800, fontSize: '0.82rem', textAlign: 'center', lineHeight: 1.2, marginBottom: 2 }}>{entry.name}</div>
      <div style={{ fontSize: '0.72rem', opacity: 0.9 }}>{entry.total_obtained}/{entry.total_max}</div>
      <div style={{ fontSize: '0.82rem', fontWeight: 800, opacity: 0.95 }}>{entry.percentage}% · {entry.grade}</div>
    </div>
  );
}
