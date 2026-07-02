import React from 'react';
import { FiAward } from 'react-icons/fi';
import { getInitials } from '../utils/helpers';

export interface RankRow {
  rank: number;
  student_id: string;
  user_id: string;
  name: string;
  admission_no: string;
  class_name: string | null;
  section_name: string | null;
  total_obtained: number;
  total_max: number;
  percentage: number;
  grade: string;
  papers: number;
  is_me: boolean;
  medal: 'gold' | 'silver' | 'bronze' | null;
}

export const GRADE_COLOR: Record<string, string> = {
  'A+': '#059669', A: '#10b981', 'B+': '#3b82f6', B: '#0ea5e9',
  C: '#f59e0b', D: '#f97316', F: '#dc2626',
};

export const MEDAL_BG: Record<string, string> = {
  gold: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
  silver: 'linear-gradient(135deg, #d4d4d8 0%, #a1a1aa 100%)',
  bronze: 'linear-gradient(135deg, #d97706 0%, #92400e 100%)',
};

/* ─── My standing (only shows for the current student when scoped to themselves) ─── */
export function MyStandingCard({ me, total }: { me: RankRow; total: number }) {
  return (
    <div className="card" style={{
      marginBottom: '0.75rem', padding: 18,
      background: 'linear-gradient(135deg, var(--primary-50) 0%, #fff 80%)',
      border: '1.5px solid var(--primary-200)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{
          minWidth: 64, height: 64, borderRadius: 16,
          background: me.medal ? MEDAL_BG[me.medal] : 'var(--primary-500)',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', padding: '4px 8px',
        }}>
          <div style={{ fontSize: '0.62rem', fontWeight: 700, opacity: 0.9 }}>RANK</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, lineHeight: 1 }}>#{me.rank}</div>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--primary-600)', letterSpacing: 0.5, textTransform: 'uppercase' }}>Your standing</div>
          <h2 style={{ margin: '4px 0 4px', fontSize: '1.2rem' }}>{me.name}</h2>
          <div style={{ fontSize: '0.82rem', color: 'var(--gray-500)' }}>
            {me.class_name}{me.section_name ? ` · Section ${me.section_name}` : ''} · #{me.rank} of {total}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 14 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.62rem', color: 'var(--gray-500)', fontWeight: 700 }}>SCORE</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: GRADE_COLOR[me.grade] || 'var(--gray-700)' }}>{me.percentage}%</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.62rem', color: 'var(--gray-500)', fontWeight: 700 }}>GRADE</div>
            <div style={{
              fontSize: '1.4rem', fontWeight: 800,
              padding: '4px 12px', borderRadius: 'var(--radius-md)',
              background: (GRADE_COLOR[me.grade] || '#999') + '20',
              color: GRADE_COLOR[me.grade] || '#999',
            }}>{me.grade}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── 1-2-3 Podium ─── */
export function PodiumStrip({ top3 }: { top3: RankRow[] }) {
  if (top3.length < 3) return null;
  return (
    <div className="card" style={{ marginBottom: '0.75rem', padding: '14px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
        <PodiumCard rank={2} entry={top3[1]} height={120} />
        <PodiumCard rank={1} entry={top3[0]} height={150} />
        <PodiumCard rank={3} entry={top3[2]} height={100} />
      </div>
    </div>
  );
}

function PodiumCard({ rank, entry, height }: { rank: number; entry: RankRow; height: number }) {
  if (!entry) return null;
  const medalKey = rank === 1 ? 'gold' : rank === 2 ? 'silver' : 'bronze';
  const emoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉';
  return (
    <div style={{
      width: 150, padding: 10, borderRadius: 'var(--radius-md)',
      background: MEDAL_BG[medalKey], color: '#fff',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end',
      minHeight: height, position: 'relative',
      boxShadow: rank === 1 ? '0 8px 24px rgba(245, 158, 11, 0.3)' : '0 4px 12px rgba(0,0,0,0.1)',
    }}>
      <div style={{ fontSize: rank === 1 ? '2.4rem' : '1.8rem', marginBottom: 4 }}>{emoji}</div>
      <div className="avatar" style={{ width: 40, height: 40, fontSize: '0.85rem', background: 'rgba(255,255,255,0.3)', color: '#fff', border: '2px solid #fff', marginBottom: 6 }}>
        {getInitials(entry.name)}
      </div>
      <div style={{ fontWeight: 800, fontSize: '0.88rem', textAlign: 'center', lineHeight: 1.2 }}>{entry.name}</div>
      <div style={{ fontSize: '0.74rem', opacity: 0.9 }}>{entry.percentage}% · {entry.grade}</div>
      {entry.is_me && <div style={{ marginTop: 4, fontSize: '0.6rem', padding: '2px 8px', background: 'rgba(255,255,255,0.3)', borderRadius: 10, fontWeight: 700 }}>YOU</div>}
    </div>
  );
}

/* ─── Full leaderboard table ─── */
export function LeaderboardTable({ rows, loading, emptyHint }: { rows: RankRow[]; loading: boolean; emptyHint?: string }) {
  return (
    <div className="card">
      <div className="card-body no-padding">
        {loading ? (
          <div className="spinner-container"><div className="spinner" /></div>
        ) : rows.length === 0 ? (
          <div className="empty-state">
            <FiAward size={32} style={{ color: 'var(--gray-300)' }} />
            <h3>{emptyHint || 'No rankings yet'}</h3>
          </div>
        ) : (
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>Rank</th>
                  <th>Student</th>
                  <th>Class</th>
                  <th style={{ width: 100 }}>Score</th>
                  <th style={{ width: 100 }}>%</th>
                  <th style={{ width: 70 }}>Grade</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const medalEmoji = r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : null;
                  return (
                    <tr key={r.student_id} style={{ background: r.is_me ? 'var(--primary-50)' : undefined }}>
                      <td style={{ fontWeight: 800, fontSize: '0.95rem' }}>
                        {medalEmoji ? `${medalEmoji} #${r.rank}` : `#${r.rank}`}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="avatar" style={{ width: 30, height: 30, fontSize: '0.7rem', background: r.is_me ? 'var(--primary-500)' : '#6366f1' }}>
                            {getInitials(r.name)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>
                              {r.name}
                              {r.is_me && <span style={{ marginLeft: 6, background: 'var(--primary-500)', color: '#fff', fontSize: '0.6rem', padding: '1px 6px', borderRadius: 8, fontWeight: 700 }}>YOU</span>}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--gray-400)' }}>{r.admission_no}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
                          {r.class_name || '—'}{r.section_name ? ` · ${r.section_name}` : ''}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700, fontSize: '0.85rem' }}>{r.total_obtained}<span style={{ color: 'var(--gray-400)' }}>/{r.total_max}</span></td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 90 }}>
                          <div style={{ flex: 1, background: 'var(--gray-100)', borderRadius: 4, height: 6 }}>
                            <div style={{
                              width: `${Math.min(100, r.percentage)}%`,
                              background: GRADE_COLOR[r.grade] || 'var(--gray-400)',
                              height: '100%', borderRadius: 4,
                            }} />
                          </div>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: GRADE_COLOR[r.grade] || 'var(--gray-700)' }}>{r.percentage}%</span>
                        </div>
                      </td>
                      <td>
                        <span style={{
                          padding: '3px 8px', borderRadius: 'var(--radius-full)', fontSize: '0.72rem', fontWeight: 800,
                          background: (GRADE_COLOR[r.grade] || '#999') + '20', color: GRADE_COLOR[r.grade] || '#999',
                        }}>{r.grade}</span>
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
  );
}
