import React, { useState, useEffect } from 'react';
import { FiCheckSquare, FiAward, FiTrendingUp, FiAlertCircle, FiCalendar } from 'react-icons/fi';
import client from '../../api/client';
import { formatDate } from '../../utils/helpers';

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  PRESENT:  { bg: '#d1fae5', color: '#059669' },
  ABSENT:   { bg: '#ffe4e6', color: '#e11d48' },
  LATE:     { bg: '#fef3c7', color: '#d97706' },
  HALF_DAY: { bg: '#ede9fe', color: '#7c3aed' },
};

type Tab = 'overview' | 'ranking' | 'history';

export default function StudentAttendance() {
  const [tab, setTab] = useState<Tab>('overview');
  const [records, setRecords] = useState<any[]>([]);
  const [board, setBoard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [boardLoading, setBoardLoading] = useState(false);

  useEffect(() => {
    client.get('/my/attendance').then(r => setRecords(Array.isArray(r.data) ? r.data : r.data.records || []))
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (tab !== 'ranking' && tab !== 'overview') return;
    if (board) return; // load once
    setBoardLoading(true);
    client.get('/my/attendance/leaderboard')
      .then(r => setBoard(r.data))
      .catch(() => setBoard(null))
      .finally(() => setBoardLoading(false));
  }, [tab]);

  const present = records.filter(r => r.status === 'PRESENT').length;
  const absent = records.filter(r => r.status === 'ABSENT').length;
  const late = records.filter(r => r.status === 'LATE').length;
  const half = records.filter(r => r.status === 'HALF_DAY').length;
  const total = records.length;
  const pct = total > 0 ? Math.round(((present + 0.5 * late + 0.5 * half) / total) * 100) : 0;

  const me = board?.me;
  const myBucket = board?.my_bucket;

  // Motivational message
  const getMotivation = () => {
    if (!me) return { emoji: '📚', title: 'Welcome!', text: 'Your attendance journey starts here.' };
    if (myBucket === 'PERFECT') return { emoji: '🏆', title: 'Perfect attendance!', text: "You're a role model. Keep this incredible streak going!" };
    if (myBucket === 'GOOD' && me.percentage >= 90) return { emoji: '🌟', title: 'Almost perfect!', text: `You're at ${me.percentage}%. Just a few more days for the top spot!` };
    if (myBucket === 'GOOD') return { emoji: '💪', title: 'Great going!', text: `You're at ${me.percentage}%. Aim for 100% — every day counts!` };
    if (myBucket === 'LOW') return { emoji: '⚠️', title: 'Time to step up', text: `You're at ${me.percentage}%. School requires 75% — show up tomorrow!` };
    return { emoji: '📅', title: 'Start strong', text: 'Attend regularly to build a strong attendance record.' };
  };
  const mot = getMotivation();

  return (
    <div>
      <div className="page-header"><h1>📅 My Attendance</h1></div>

      {/* Hero motivational card */}
      {board?.me && (
        <div className="card" style={{ marginBottom: 16, padding: 20, background: 'linear-gradient(135deg, var(--primary-50) 0%, #ffffff 100%)', border: '1px solid var(--primary-100)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ fontSize: '3rem', lineHeight: 1 }}>{mot.emoji}</div>
            <div style={{ flex: 1, minWidth: 240 }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--primary-700)' }}>{mot.title}</h2>
              <p style={{ margin: '4px 0 0', color: 'var(--gray-600)', fontSize: '0.9rem' }}>{mot.text}</p>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ textAlign: 'center', padding: '10px 16px', background: '#fff', borderRadius: 'var(--radius-md)', border: '1px solid var(--gray-200)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)', fontWeight: 600 }}>YOUR %</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: pct >= 75 ? 'var(--success-600)' : 'var(--danger-600)' }}>{me?.percentage}%</div>
              </div>
              {me?.class_rank && (
                <div style={{ textAlign: 'center', padding: '10px 16px', background: '#fff', borderRadius: 'var(--radius-md)', border: '1px solid var(--gray-200)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)', fontWeight: 600 }}>CLASS RANK</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary-600)' }}>#{me.class_rank}<span style={{ fontSize: '0.8rem', color: 'var(--gray-400)' }}> / {board.class_total}</span></div>
                </div>
              )}
              <div style={{ textAlign: 'center', padding: '10px 16px', background: '#fff', borderRadius: 'var(--radius-md)', border: '1px solid var(--gray-200)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)', fontWeight: 600 }}>SCHOOL RANK</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--success-600)' }}>#{me?.school_rank}<span style={{ fontSize: '0.8rem', color: 'var(--gray-400)' }}> / {board?.school_total}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="tabs">
        <button className={`tab ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>Overview</button>
        <button className={`tab ${tab === 'ranking' ? 'active' : ''}`} onClick={() => setTab('ranking')}>🏆 Leaderboard</button>
        <button className={`tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>Daily History</button>
      </div>

      {/* ─── OVERVIEW TAB ─── */}
      {tab === 'overview' && (
        <>
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <div className="stat-card green">
              <div className="stat-icon green"><FiCheckSquare /></div>
              <div className="stat-info"><span className="label">Present</span><span className="value">{present}</span></div>
            </div>
            <div className="stat-card rose">
              <div className="stat-icon rose"><FiAlertCircle /></div>
              <div className="stat-info"><span className="label">Absent</span><span className="value">{absent}</span></div>
            </div>
            <div className="stat-card amber">
              <div className="stat-icon amber"><FiCalendar /></div>
              <div className="stat-info"><span className="label">Late</span><span className="value">{late}</span></div>
            </div>
            <div className="stat-card blue">
              <div className="stat-icon blue"><FiTrendingUp /></div>
              <div className="stat-info">
                <span className="label">Percentage</span>
                <span className="value">{pct}%</span>
                <div className="progress-bar-wrapper mt-1">
                  <div className="progress-bar-fill" style={{ width: `${pct}%`, background: pct >= 75 ? 'var(--success-500)' : 'var(--danger-500)' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Bucket distribution in your class */}
          {board?.class_buckets && (
            <div className="card" style={{ marginTop: 16 }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gray-100)' }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem' }}>How your class is doing</h3>
              </div>
              <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <div style={{ padding: 14, background: 'var(--success-50)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.8rem' }}>🏆</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--success-600)' }}>{board.class_buckets.perfect}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--success-700)', fontWeight: 600 }}>at 100%</div>
                </div>
                <div style={{ padding: 14, background: 'var(--primary-50)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.8rem' }}>💪</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary-600)' }}>{board.class_buckets.good}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--primary-700)', fontWeight: 600 }}>at 75–99%</div>
                </div>
                <div style={{ padding: 14, background: 'var(--danger-50)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.8rem' }}>⚠️</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--danger-600)' }}>{board.class_buckets.low}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--danger-700)', fontWeight: 600 }}>below 75%</div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── RANKING TAB ─── */}
      {tab === 'ranking' && (
        boardLoading ? <div className="card"><div className="spinner-container"><div className="spinner" /></div></div>
        : !board ? <div className="card"><div className="empty-state"><h3>No data yet</h3></div></div>
        : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
            {/* Top in Class */}
            <div className="card">
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gray-100)' }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem' }}>🏆 Top in your class ({me?.class_name}{me?.section_name ? ` - ${me.section_name}` : ''})</h3>
              </div>
              <div className="card-body no-padding">
                {board.top_class.length === 0 ? (
                  <div className="empty-state"><p>No class data yet.</p></div>
                ) : (
                  <table className="data-table">
                    <thead><tr><th>Rank</th><th>Student</th><th>%</th></tr></thead>
                    <tbody>
                      {board.top_class.map((p: any) => {
                        const isMe = me && p.student_id === me.student_id;
                        return (
                          <tr key={p.student_id} style={{ background: isMe ? 'var(--primary-50)' : undefined }}>
                            <td style={{ fontWeight: 800, fontSize: '0.95rem' }}>
                              {p.class_rank === 1 ? '🥇 #1' : p.class_rank === 2 ? '🥈 #2' : p.class_rank === 3 ? '🥉 #3' : `#${p.class_rank}`}
                            </td>
                            <td>
                              <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>
                                {p.first_name} {p.last_name}
                                {isMe && <span className="badge" style={{ marginLeft: 6, background: 'var(--primary-500)', color: '#fff', fontSize: '0.65rem' }}>YOU</span>}
                              </div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--gray-400)' }}>{p.admission_no}</div>
                            </td>
                            <td style={{ fontWeight: 700, color: p.percentage >= 100 ? 'var(--success-600)' : p.percentage >= 75 ? 'var(--primary-600)' : 'var(--danger-600)' }}>{p.percentage}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Top in School */}
            <div className="card">
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gray-100)' }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem' }}>🌟 Top in school</h3>
              </div>
              <div className="card-body no-padding">
                <table className="data-table">
                  <thead><tr><th>Rank</th><th>Student</th><th>Class</th><th>%</th></tr></thead>
                  <tbody>
                    {board.top_school.map((p: any) => {
                      const isMe = me && p.student_id === me.student_id;
                      return (
                        <tr key={p.student_id} style={{ background: isMe ? 'var(--primary-50)' : undefined }}>
                          <td style={{ fontWeight: 800, fontSize: '0.95rem' }}>
                            {p.school_rank === 1 ? '🥇 #1' : p.school_rank === 2 ? '🥈 #2' : p.school_rank === 3 ? '🥉 #3' : `#${p.school_rank}`}
                          </td>
                          <td>
                            <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>
                              {p.first_name} {p.last_name}
                              {isMe && <span className="badge" style={{ marginLeft: 6, background: 'var(--primary-500)', color: '#fff', fontSize: '0.65rem' }}>YOU</span>}
                            </div>
                          </td>
                          <td><span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>{p.class_name}{p.section_name ? ` - ${p.section_name}` : ''}</span></td>
                          <td style={{ fontWeight: 700, color: p.percentage >= 100 ? 'var(--success-600)' : p.percentage >= 75 ? 'var(--primary-600)' : 'var(--danger-600)' }}>{p.percentage}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      )}

      {/* ─── HISTORY TAB ─── */}
      {tab === 'history' && (
        <div className="card">
          <div className="card-body no-padding">
            {loading ? (
              <div className="spinner-container"><div className="spinner" /></div>
            ) : records.length === 0 ? (
              <div className="empty-state"><h3>No attendance records</h3><p>Your attendance will be recorded by your teacher</p></div>
            ) : (
              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead><tr><th>Date</th><th>Status</th></tr></thead>
                  <tbody>
                    {records.map((r, i) => {
                      const cfg = STATUS_COLORS[r.status] || STATUS_COLORS.PRESENT;
                      return (
                        <tr key={r.id || i}>
                          <td>{formatDate(r.date)}</td>
                          <td><span className="badge" style={{ background: cfg.bg, color: cfg.color }}>{r.status.replace('_', ' ')}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
