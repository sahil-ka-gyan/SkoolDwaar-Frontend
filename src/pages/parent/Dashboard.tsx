import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FiBarChart2, FiDollarSign, FiTruck, FiBell, FiUser, FiBookOpen,
  FiCheckSquare, FiAward, FiCalendar, FiHeart, FiFileText, FiMessageCircle,
  FiClock, FiTrendingUp, FiActivity, FiZap,
} from 'react-icons/fi';
import { useAuthStore } from '../../stores/authStore';
import { getGreeting, getInitials } from '../../utils/helpers';
import client from '../../api/client';
import { ResultAnnouncementCard } from '../student/Dashboard';

function useLiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(id);
  }, []);
  return now;
}

function ProgressRing({ value, label, color = 'indigo', size = 168 }: { value: number; label: string; color?: 'indigo' | 'emerald' | 'amber' | 'rose'; size?: number }) {
  const r = (size - 16) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.max(0, Math.min(100, value)) / 100) * c;
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
            <div className="ring-value">{value}%</div>
            <div className="ring-label">{label}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ParentDashboard() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [children, setChildren] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string>(() => localStorage.getItem('selectedChildId') || '');
  const [progress, setProgress] = useState<any>(null);
  const [resultAnnouncements, setResultAnnouncements] = useState<any[]>([]);
  const now = useLiveClock();

  useEffect(() => {
    client.get('/parent/children')
      .then(r => {
        const list = r.data || [];
        setChildren(list);
        if (list.length > 0 && (!selectedId || !list.find((c: any) => c.student_id === selectedId))) {
          setSelectedId(list[0].student_id);
          localStorage.setItem('selectedChildId', list[0].student_id);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    localStorage.setItem('selectedChildId', selectedId);
    client.get(`/parent/child/${selectedId}/progress`)
      .then(r => setProgress(r.data || null))
      .catch(() => setProgress(null));
    client.get(`/parent/child/${selectedId}/latest-result-announcements`)
      .then(r => setResultAnnouncements(Array.isArray(r.data) ? r.data : []))
      .catch(() => setResultAnnouncements([]));
  }, [selectedId]);

  if (loading) return <div className="spinner-container"><div className="spinner" /></div>;

  const selectedChild = children.find(c => c.student_id === selectedId);
  const childName = selectedChild ? selectedChild.first_name : 'Your child';
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  const childColors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  const quickActions = [
    { icon: <FiBarChart2 />,    label: 'Progress',     sub: 'Marks & growth',     path: '/parent/child-progress', color: '#4f46e5' },
    { icon: <FiFileText />,     label: 'Results',      sub: 'Exam reports',       path: '/parent/results',        color: '#10b981' },
    { icon: <FiCheckSquare />,  label: 'Timetable',    sub: 'Daily classes',      path: '/parent/timetable',      color: '#0ea5e9' },
    { icon: <FiDollarSign />,   label: 'Fees',         sub: 'Pay & receipts',     path: '/parent/fees',           color: '#d97706' },
    { icon: <FiTruck />,        label: 'Transport',    sub: 'Bus route',          path: '/parent/transport',      color: '#8b5cf6' },
    { icon: <FiBell />,         label: 'Notices',      sub: 'Announcements',      path: '/parent/notices',        color: '#f59e0b' },
    { icon: <FiClock />,        label: 'Leave',        sub: 'Apply / status',     path: '/parent/leave',          color: '#ea580c' },
    { icon: <FiMessageCircle />, label: 'Messages',    sub: 'Chat with teacher',  path: '/parent/messages',       color: '#ec4899' },
  ];

  const attendance = progress?.attendance || { percentage: 0, present: 0, total: 0 };
  const academics = progress?.academics || { average_marks: 0, total_exams_taken: 0 };

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
      <div className="dash-hero parent">
        <div className="dash-hero-inner">
          <div className="dash-hero-text">
            <h2>{getGreeting()}, {user?.first_name}! <FiHeart style={{ verticalAlign: 'middle', color: '#fcd34d' }} /></h2>
            <p>Stay close to your {children.length > 1 ? 'children' : 'child'}'s school journey — every step, every win.</p>
            <div className="dash-hero-meta">
              <span className="hero-chip"><FiUser /> Parent Portal</span>
              <span className="hero-chip"><FiBookOpen /> {children.length} {children.length === 1 ? 'child' : 'children'}</span>
              {selectedChild && <span className="hero-chip"><FiAward /> Viewing {selectedChild.first_name}</span>}
            </div>
          </div>
          <div className="hero-clock">
            <div className="time">{timeStr}</div>
            <div className="date">{dateStr}</div>
          </div>
        </div>
      </div>

      {/* ─── Child switcher ─── */}
      {children.length === 0 ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="empty-state">
            <FiUser size={28} style={{ color: 'var(--gray-300)' }} />
            <h3>No children linked</h3>
            <p>Please contact the school admin to link your child(ren) to your account.</p>
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '.5rem' }}>
            <h3 style={{ fontSize: '.95rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ display: 'inline-block', width: 4, height: 16, borderRadius: 2, background: 'linear-gradient(180deg, #ec4899, #fbbf24)' }} />
              My Children ({children.length})
            </h3>
          </div>
          <div className="child-rail">
            {children.map((c: any, i: number) => {
              const isActive = c.student_id === selectedId;
              const bg = childColors[i % childColors.length];
              return (
                <button key={c.student_id} onClick={() => setSelectedId(c.student_id)}
                        className={`child-pill ${isActive ? 'active' : ''}`}>
                  <div className="avatar" style={{ background: bg }}>
                    {getInitials(`${c.first_name || ''} ${c.last_name || ''}`)}
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div className="nm">{c.first_name} {c.last_name}</div>
                    <div className="cls">{c.class_name}{c.section_name ? ` · ${c.section_name}` : ''} · {c.admission_no}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Result announcements ─── */}
      {resultAnnouncements.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
          {resultAnnouncements.map(r => (
            <ResultAnnouncementCard key={r.exam_id} data={r} who={childName} />
          ))}
        </div>
      )}

      {/* ─── Child metrics + Rings ─── */}
      {selectedChild && (
        <>
          <div className="metric-grid">
            <div className="metric-card indigo">
              <div className="metric-top">
                <div className="metric-icon indigo"><FiUser /></div>
                <span className="metric-trend flat">Profile</span>
              </div>
              <div className="metric-label">Viewing</div>
              <div className="metric-value" style={{ fontSize: '1.3rem' }}>{selectedChild.first_name}</div>
              <div className="metric-sub"><FiBookOpen size={12} /> {selectedChild.class_name}{selectedChild.section_name ? ` - ${selectedChild.section_name}` : ''}</div>
            </div>

            <div className="metric-card emerald">
              <div className="metric-top">
                <div className="metric-icon emerald"><FiCheckSquare /></div>
                <span className={`metric-trend ${attendance.percentage >= 75 ? 'up' : 'down'}`}>
                  <FiTrendingUp /> {attendance.percentage}%
                </span>
              </div>
              <div className="metric-label">Attendance</div>
              <div className="metric-value">{attendance.percentage ?? 0}%</div>
              <div className="metric-sub"><FiActivity size={12} /> {attendance.present || 0}/{attendance.total || 0} days present</div>
            </div>

            <div className="metric-card amber">
              <div className="metric-top">
                <div className="metric-icon amber"><FiAward /></div>
                <span className="metric-trend up"><FiTrendingUp /> Avg</span>
              </div>
              <div className="metric-label">Average Marks</div>
              <div className="metric-value">{academics.average_marks ?? '—'}</div>
              <div className="metric-sub"><FiFileText size={12} /> {academics.total_exams_taken || 0} exams taken</div>
            </div>

            <div className="metric-card violet">
              <div className="metric-top">
                <div className="metric-icon violet"><FiCalendar /></div>
                <span className="metric-trend flat">Today</span>
              </div>
              <div className="metric-label">School Status</div>
              <div className="metric-value" style={{ fontSize: '1.3rem' }}>On Track</div>
              <div className="metric-sub"><FiZap size={12} /> Keep encouraging {childName}!</div>
            </div>
          </div>

          {/* ─── Big rings row ─── */}
          <div className="dash-main-grid">
            <div className="card">
              <div className="card-header">
                <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ display: 'inline-block', width: 4, height: 18, borderRadius: 2, background: 'linear-gradient(180deg, #6366f1, #ec4899)' }} />
                  {childName}'s Snapshot
                </h3>
                <Link to="/parent/child-progress">Full progress →</Link>
              </div>
              <div className="card-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <ProgressRing value={Number(attendance.percentage) || 0} label="Attendance" color="emerald" />
                  <ProgressRing value={Number(academics.average_marks) || 0} label="Avg Marks" color="indigo" />
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ display: 'inline-block', width: 4, height: 18, borderRadius: 2, background: 'linear-gradient(180deg, #f59e0b, #ec4899)' }} />
                  Family Highlights
                </h3>
              </div>
              <div className="card-body" style={{ paddingTop: 0 }}>
                <ul className="activity-list" style={{ listStyle: 'none', padding: 0 }}>
                  <li className="activity-item">
                    <div className="activity-icon success"><FiCheckSquare /></div>
                    <div className="activity-content">
                      <div className="title">Attendance looks {attendance.percentage >= 75 ? 'great' : 'low'}</div>
                      <div className="meta">{attendance.present || 0} present out of {attendance.total || 0} school days</div>
                    </div>
                  </li>
                  <li className="activity-item">
                    <div className="activity-icon info"><FiAward /></div>
                    <div className="activity-content">
                      <div className="title">Academic average: {academics.average_marks ?? '—'}</div>
                      <div className="meta">Across {academics.total_exams_taken || 0} exam(s) so far</div>
                    </div>
                  </li>
                  <li className="activity-item">
                    <div className="activity-icon warn"><FiDollarSign /></div>
                    <div className="activity-content">
                      <div className="title">Fee status</div>
                      <div className="meta">Check pending dues or download receipts</div>
                    </div>
                  </li>
                  <li className="activity-item">
                    <div className="activity-icon violet"><FiBell /></div>
                    <div className="activity-content">
                      <div className="title">School notices</div>
                      <div className="meta">Stay informed of upcoming events</div>
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
        </>
      )}
    </div>
  );
}
