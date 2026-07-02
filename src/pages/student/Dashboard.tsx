import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FiCheckSquare, FiFileText, FiBarChart2, FiAward, FiClock, FiCalendar,
  FiBookOpen, FiTrendingUp, FiActivity, FiZap, FiTarget, FiStar,
} from 'react-icons/fi';
import { useAuthStore } from '../../stores/authStore';
import { getGreeting } from '../../utils/helpers';
import client from '../../api/client';

const GRADE_COLOR: Record<string, string> = {
  'A+': '#059669', A: '#10b981', 'B+': '#3b82f6', B: '#0ea5e9',
  C: '#f59e0b', D: '#f97316', F: '#dc2626',
};

function useLiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(id);
  }, []);
  return now;
}

function ProgressRing({ value, label, color = 'indigo', size = 180 }: { value: number; label: string; color?: 'indigo' | 'emerald' | 'amber' | 'rose'; size?: number }) {
  const r = (size - 16) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  const offset = c - (v / 100) * c;
  return (
    <div className="ring-wrap">
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg className="ring-svg" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle className="ring-bg" cx={size / 2} cy={size / 2} r={r} />
          <circle className={`ring-fg ${color}`} cx={size / 2} cy={size / 2} r={r}
                  strokeDasharray={c} strokeDashoffset={offset} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="ring-center">
            <div className="ring-value">{v}%</div>
            <div className="ring-label">{label}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StudentDashboard() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [resultAnnouncements, setResultAnnouncements] = useState<any[]>([]);
  const now = useLiveClock();

  useEffect(() => {
    client.get('/dashboard')
      .then(res => setStats(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
    client.get('/my/latest-result-announcements')
      .then(r => setResultAnnouncements(Array.isArray(r.data) ? r.data : []))
      .catch(() => {});
  }, []);

  if (loading) return <div className="spinner-container"><div className="spinner" /></div>;

  const att = stats?.attendance || { present: 0, total: 0, percentage: 0 };
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  const quickActions = [
    { icon: <FiFileText />,    label: 'Daily Diary',  sub: 'Homework & classwork', path: '/student/diary', color: '#4f46e5' },
    { icon: <FiBarChart2 />,   label: 'Results',      sub: 'Marks & grades',    path: '/student/results',     color: '#10b981' },
    { icon: <FiCheckSquare />, label: 'Attendance',   sub: 'Day-by-day',        path: '/student/attendance',  color: '#0ea5e9' },
    { icon: <FiClock />,       label: 'Timetable',    sub: 'Today\'s classes',  path: '/student/timetable',   color: '#7c3aed' },
    { icon: <FiBarChart2 />,   label: 'Analytics',    sub: 'Performance graph', path: '/student/analytics',   color: '#f59e0b' },
    { icon: <FiAward />,       label: 'Leaderboard',  sub: 'Top performers',    path: '/student/leaderboard', color: '#e11d48' },
    { icon: <FiClock />,       label: 'Apply Leave',  sub: 'Submit request',    path: '/student/leave',       color: '#ea580c' },
    { icon: <FiCalendar />,    label: 'Exams',        sub: 'Schedule',          path: '/student/exams',       color: '#8b5cf6' },
  ];

  // motivational quote rotation
  const quotes = [
    'Every expert was once a beginner.',
    'Small steps daily beat giant leaps yearly.',
    'Your only limit is the one you set yourself.',
    'Learning is a treasure that follows you everywhere.',
    'Believe you can and you\'re halfway there.',
  ];
  const quote = quotes[now.getDate() % quotes.length];

  return (
    <div className="page-enter">
      {/* SVG defs */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <linearGradient id="ringIndigo" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6366f1" /><stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
          <linearGradient id="ringEmerald" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#10b981" /><stop offset="100%" stopColor="#34d399" />
          </linearGradient>
          <linearGradient id="ringAmber" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f59e0b" /><stop offset="100%" stopColor="#fbbf24" />
          </linearGradient>
          <linearGradient id="ringRose" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f43f5e" /><stop offset="100%" stopColor="#fb7185" />
          </linearGradient>
        </defs>
      </svg>

      {/* ─── Hero ─── */}
      <div className="dash-hero student">
        <div className="dash-hero-inner">
          <div className="dash-hero-text">
            <h2>{getGreeting()}, {user?.first_name}! 🎓</h2>
            <p>"{quote}"</p>
            <div className="dash-hero-meta">
              <span className="hero-chip"><FiZap /> Student Portal</span>
              <span className="hero-chip"><FiBookOpen /> ID: {stats?.admission_no || '—'}</span>
              <span className="hero-chip"><FiTarget /> {att.percentage}% attendance</span>
            </div>
          </div>
          <div className="hero-clock">
            <div className="time">{timeStr}</div>
            <div className="date">{dateStr}</div>
          </div>
        </div>
      </div>

      {/* ─── Result announcement cards ─── */}
      {resultAnnouncements.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
          {resultAnnouncements.map(r => (
            <ResultAnnouncementCard key={r.exam_id} data={r} who="you" />
          ))}
        </div>
      )}

      {/* ─── Streak / Motivation strip ─── */}
      <div className="streak-card" style={{ marginBottom: '1.25rem' }}>
        <div className="streak-flame">🔥</div>
        <div className="streak-text" style={{ flex: 1 }}>
          <div className="num">{att.percentage}%</div>
          <div className="lbl">Attendance — keep showing up, keep growing!</div>
        </div>
        <Link to="/student/attendance" style={{ background: 'rgba(255,255,255,.6)', padding: '.55rem 1rem', borderRadius: 999, fontWeight: 700, fontSize: '.82rem', color: '#78350f', textDecoration: 'none', whiteSpace: 'nowrap' }}>
          View record →
        </Link>
      </div>

      {/* ─── Metric cards ─── */}
      <div className="metric-grid">
        <div className="metric-card indigo">
          <div className="metric-top">
            <div className="metric-icon indigo"><FiCalendar /></div>
            <span className="metric-trend flat">ID</span>
          </div>
          <div className="metric-label">Admission No</div>
          <div className="metric-value" style={{ fontSize: '1.4rem' }}>{stats?.admission_no || '—'}</div>
          <div className="metric-sub"><FiActivity size={12} /> Your unique student ID</div>
        </div>

        <div className="metric-card emerald">
          <div className="metric-top">
            <div className="metric-icon emerald"><FiCheckSquare /></div>
            <span className={`metric-trend ${att.percentage >= 75 ? 'up' : 'down'}`}>
              <FiTrendingUp /> {att.percentage}%
            </span>
          </div>
          <div className="metric-label">Attendance</div>
          <div className="metric-value">{att.percentage}%</div>
          <div className="metric-sub"><FiCheckSquare size={12} /> {att.present}/{att.total} days present</div>
        </div>

        <div className="metric-card amber">
          <div className="metric-top">
            <div className="metric-icon amber"><FiFileText /></div>
            <span className="metric-trend flat">Tasks</span>
          </div>
          <div className="metric-label">Today's Diary</div>
          <div className="metric-value">—</div>
          <div className="metric-sub"><FiClock size={12} /> Homework & classwork</div>
        </div>

        <div className="metric-card violet">
          <div className="metric-top">
            <div className="metric-icon violet"><FiAward /></div>
            <span className="metric-trend up"><FiStar /> Goal</span>
          </div>
          <div className="metric-label">Today's Mood</div>
          <div className="metric-value" style={{ fontSize: '1.3rem' }}>Let's go! 🚀</div>
          <div className="metric-sub"><FiZap size={12} /> One step closer every day</div>
        </div>
      </div>

      {/* ─── Rings + quick info ─── */}
      <div className="dash-main-grid">
        <div className="card">
          <div className="card-header">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ display: 'inline-block', width: 4, height: 18, borderRadius: 2, background: 'linear-gradient(180deg, #10b981, #6366f1)' }} />
              Performance Snapshot
            </h3>
            <Link to="/student/analytics">Full analytics →</Link>
          </div>
          <div className="card-body">
            {att.total > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <ProgressRing value={att.percentage} label="Attendance" color="emerald" />
                <ProgressRing value={Math.min(100, (att.present / Math.max(1, att.total)) * 100)} label="Days Present" color="indigo" />
              </div>
            ) : (
              <div className="empty-state">
                <FiCheckSquare style={{ fontSize: '2rem', color: 'var(--gray-300)' }} />
                <h3>No attendance data yet</h3>
                <p>Records will appear once your teacher marks attendance</p>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ display: 'inline-block', width: 4, height: 18, borderRadius: 2, background: 'linear-gradient(180deg, #f59e0b, #ec4899)' }} />
              Today's Pulse
            </h3>
          </div>
          <div className="card-body" style={{ paddingTop: 0 }}>
            <ul className="activity-list" style={{ listStyle: 'none', padding: 0 }}>
              <li className="activity-item">
                <div className="activity-icon success"><FiCheckSquare /></div>
                <div className="activity-content">
                  <div className="title">Attendance is {att.percentage >= 75 ? 'on track' : 'needs attention'}</div>
                  <div className="meta">{att.present}/{att.total} days present this term</div>
                </div>
              </li>
              <li className="activity-item">
                <div className="activity-icon info"><FiFileText /></div>
                <div className="activity-content">
                  <div className="title">Open today's diary</div>
                  <div className="meta">Stay ahead — homework, classwork and reminders</div>
                </div>
              </li>
              <li className="activity-item">
                <div className="activity-icon warn"><FiAward /></div>
                <div className="activity-content">
                  <div className="title">Aim for the leaderboard</div>
                  <div className="meta">Compare your standing in class</div>
                </div>
              </li>
              <li className="activity-item">
                <div className="activity-icon violet"><FiBookOpen /></div>
                <div className="activity-content">
                  <div className="title">Plan your week</div>
                  <div className="meta">View timetable & upcoming exams</div>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* ─── Quick Actions ─── */}
      <div className="section-head">
        <h3><span className="accent-bar" />⚡ Quick Access</h3>
      </div>
      <div className="action-grid">
        {quickActions.map(qa => (
          <Link key={qa.path} to={qa.path} className="action-card" style={{ color: qa.color }}>
            <div className="ac-icon" style={{ background: `${qa.color}15`, color: qa.color }}>{qa.icon}</div>
            <div className="ac-label" style={{ color: 'var(--text-primary)' }}>{qa.label}</div>
            <div className="ac-sub">{qa.sub}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}


/* ─── Result Announcement Card (shared between student & parent) ─── */
export function ResultAnnouncementCard({ data, who }: { data: any; who: 'you' | string }) {
  const r = data;
  const isTop5 = r.is_top5;
  const rank = r.rank;
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank === 4 ? '🏅' : rank === 5 ? '🏅' : null;
  const gradeColor = GRADE_COLOR[r.grade] || 'var(--gray-500)';
  const isYou = who === 'you';
  const childName = who === 'you' ? 'You' : who;

  if (isTop5) {
    return (
      <div style={{
        position: 'relative', overflow: 'hidden',
        padding: '18px 20px',
        borderRadius: 'var(--radius-lg, 12px)',
        background: rank === 1
          ? 'linear-gradient(135deg, #fef3c7 0%, #fde68a 40%, #fbbf24 100%)'
          : rank === 2
            ? 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 40%, #cbd5e1 100%)'
            : rank === 3
              ? 'linear-gradient(135deg, #fef3c7 0%, #fed7aa 40%, #fdba74 100%)'
              : 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 40%, #c4b5fd 100%)',
        border: `2px solid ${rank === 1 ? '#f59e0b' : rank === 2 ? '#94a3b8' : rank === 3 ? '#f97316' : '#8b5cf6'}`,
        boxShadow: rank === 1 ? '0 8px 32px rgba(245,158,11,0.25)' : '0 4px 16px rgba(0,0,0,0.08)',
      }}>
        {rank === 1 && (
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
            {[...Array(8)].map((_, i) => (
              <div key={i} style={{
                position: 'absolute',
                width: 6, height: 6, borderRadius: '50%',
                background: ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'][i],
                top: `${10 + Math.random() * 80}%`,
                left: `${5 + Math.random() * 90}%`,
                opacity: 0.5,
              }} />
            ))}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '2rem', flexShrink: 0,
            border: '3px solid rgba(255,255,255,0.8)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          }}>
            {medal || `#${rank}`}
          </div>

          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{
              fontSize: '0.7rem', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: 0.8,
              color: rank === 1 ? '#92400e' : rank === 2 ? '#475569' : rank === 3 ? '#9a3412' : '#5b21b6',
              marginBottom: 4,
            }}>
              🎉 {r.exam_type.replace('_', ' ')} — Result Announced
            </div>
            <div style={{
              fontSize: '1.15rem', fontWeight: 800,
              color: rank === 1 ? '#78350f' : rank === 2 ? '#1e293b' : rank === 3 ? '#7c2d12' : '#3b0764',
              lineHeight: 1.3,
            }}>
              {rank === 1
                ? `🏆 ${isYou ? "Congratulations! You're" : `${childName} is`} the Class Topper!`
                : `🌟 ${isYou ? "Amazing! You" : `${childName}`} secured Rank #${rank} in class!`
              }
            </div>
            <div style={{
              fontSize: '0.84rem', fontWeight: 600,
              color: rank === 1 ? '#92400e' : rank === 2 ? '#334155' : rank === 3 ? '#9a3412' : '#4c1d95',
              marginTop: 4,
            }}>
              {r.exam_name} — scored <strong>{r.percentage}%</strong> ({r.total_obtained}/{r.total_max}) · Grade <strong>{r.grade}</strong>
              {r.total_students > 0 && ` · out of ${r.total_students} students`}
            </div>
          </div>

          <div style={{
            textAlign: 'center', flexShrink: 0,
            padding: '10px 16px',
            background: 'rgba(255,255,255,0.7)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(255,255,255,0.9)',
          }}>
            <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.3 }}>Rank</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: gradeColor, lineHeight: 1 }}>#{rank}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--gray-500)', fontWeight: 600 }}>of {r.total_students}</div>
          </div>
        </div>

        <div style={{ textAlign: 'right', marginTop: 6, position: 'relative', zIndex: 1 }}>
          <Link to={isYou ? '/student/results' : '/parent/results'} style={{
            fontSize: '0.76rem', fontWeight: 700,
            color: rank === 1 ? '#92400e' : rank === 2 ? '#334155' : rank === 3 ? '#9a3412' : '#4c1d95',
            textDecoration: 'underline', textUnderlineOffset: 2,
          }}>
            View full report card →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      padding: '14px 18px',
      borderRadius: 'var(--radius-lg, 12px)',
      background: 'linear-gradient(135deg, #f0f9ff 0%, #f8fafc 100%)',
      border: '1px solid #bae6fd',
      display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: '50%',
        background: '#e0f2fe',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '1.2rem', flexShrink: 0,
        border: '2px solid #7dd3fc',
      }}>
        📊
      </div>
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', color: '#0369a1', letterSpacing: 0.5 }}>
          {r.exam_type.replace('_', ' ')} — Result Announced
        </div>
        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0c4a6e', lineHeight: 1.3, marginTop: 2 }}>
          {r.exam_name} — {isYou ? 'You' : childName} scored <strong>{r.percentage}%</strong> ({r.total_obtained}/{r.total_max})
        </div>
        <div style={{ fontSize: '0.8rem', color: '#0369a1', marginTop: 3 }}>
          Rank <strong>#{rank}</strong> out of {r.total_students} students · Grade <strong style={{ color: gradeColor }}>{r.grade}</strong>
          {' · '}{r.result === 'PASS'
            ? <span style={{ color: '#16a34a', fontWeight: 700 }}>✓ Passed</span>
            : <span style={{ color: '#dc2626', fontWeight: 700 }}>✗ Failed</span>
          }
        </div>
      </div>
      <Link to={isYou ? '/student/results' : '/parent/results'} style={{
        padding: '6px 14px', borderRadius: 'var(--radius-full, 20px)',
        background: '#0284c7', color: '#fff',
        fontSize: '0.76rem', fontWeight: 700,
        textDecoration: 'none', whiteSpace: 'nowrap',
      }}>
        View Details
      </Link>
    </div>
  );
}
