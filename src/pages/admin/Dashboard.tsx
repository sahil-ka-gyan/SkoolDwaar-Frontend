import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FiUsers, FiUser, FiCheckSquare, FiDollarSign,
  FiBookOpen, FiClipboard, FiBell, FiTruck, FiClock,
  FiLayers, FiFileText, FiSettings, FiTrendingDown, FiTrendingUp,
  FiMessageSquare, FiUserCheck, FiGift, FiCalendar,
  FiActivity, FiArrowUpRight, FiAward, FiZap,
} from 'react-icons/fi';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  AreaChart, Area,
} from 'recharts';
import { useAuthStore } from '../../stores/authStore';
import { getGreeting, formatINR } from '../../utils/helpers';
import client from '../../api/client';

const mockAttendanceWeek = [
  { day: 'Mon', present: 92, absent: 8 },
  { day: 'Tue', present: 88, absent: 12 },
  { day: 'Wed', present: 95, absent: 5 },
  { day: 'Thu', present: 91, absent: 9 },
  { day: 'Fri', present: 87, absent: 13 },
];

const mockFeesTrend = [
  { m: 'Jan', v: 240000 },
  { m: 'Feb', v: 290000 },
  { m: 'Mar', v: 310000 },
  { m: 'Apr', v: 280000 },
  { m: 'May', v: 350000 },
  { m: 'Jun', v: 410000 },
];

function useLiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function AdminDashboard() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<any>(null);
  const [expSummary, setExpSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const now = useLiveClock();

  useEffect(() => {
    Promise.all([
      client.get('/dashboard').then(r => setStats(r.data)).catch(() => {}),
      client.get('/expenses/summary').then(r => setExpSummary(r.data)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="spinner-container"><div className="spinner" /></div>;

  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });

  const attPct = stats?.attendance_today?.percentage || 0;
  const attTrendUp = attPct >= 85;

  const quickActions = [
    { icon: <FiUsers />,       label: 'Students',     sub: 'Roster & admissions', path: '/admin/students',    color: '#4f46e5' },
    { icon: <FiUser />,        label: 'Teachers',     sub: 'Staff directory',     path: '/admin/teachers',    color: '#059669' },
    { icon: <FiLayers />,      label: 'Classes',      sub: 'Sections & rooms',    path: '/admin/classes',     color: '#7c3aed' },
    { icon: <FiBookOpen />,    label: 'Subjects',     sub: 'Curriculum',          path: '/admin/subjects',    color: '#0284c7' },
    { icon: <FiDollarSign />,  label: 'Fees',         sub: 'Billing & receipts',  path: '/admin/fees',        color: '#d97706' },
    { icon: <FiClipboard />,   label: 'Exams',        sub: 'Schedule & results',  path: '/admin/exams',       color: '#e11d48' },
    { icon: <FiCheckSquare />, label: 'Attendance',   sub: 'Daily marking',       path: '/admin/attendance',  color: '#10b981' },
    { icon: <FiFileText />,    label: 'Daily Diary',  sub: 'Homework & classwork', path: '/teacher/diary',     color: '#6366f1' },
    { icon: <FiBell />,        label: 'Notices',      sub: 'Announcements',       path: '/admin/notices',     color: '#f59e0b' },
    { icon: <FiTruck />,       label: 'Transport',    sub: 'Routes & vehicles',   path: '/admin/transport',   color: '#8b5cf6' },
    { icon: <FiClock />,       label: 'Leaves',       sub: 'Approvals',           path: '/admin/leaves',      color: '#ea580c' },
    { icon: <FiTrendingDown />,label: 'Expenses',     sub: 'Spend & vendors',     path: '/admin/expenses',    color: '#dc2626' },
    { icon: <FiMessageSquare />, label: 'Enquiries',  sub: 'Admissions inbox',    path: '/admin/enquiries',   color: '#0ea5e9' },
    { icon: <FiUserCheck />,   label: 'Staff Attend', sub: 'Teacher attendance',  path: '/admin/staff-attendance', color: '#16a34a' },
    { icon: <FiSettings />,    label: 'Settings',     sub: 'School config',       path: '/admin/settings',    color: '#64748b' },
  ];

  const recentActivities = [
    { icon: <FiUserCheck />, color: 'success', title: 'Attendance posted', meta: `${stats?.attendance_today?.present || 0} students present today` },
    { icon: <FiDollarSign />, color: 'info', title: 'Fee collection running', meta: `${formatINR(stats?.total_fee_collected || 0)} collected all-time` },
    { icon: <FiBell />, color: 'warn', title: 'Recent notices', meta: `${stats?.recent_notices?.length || 0} active notices on board` },
    { icon: <FiTrendingDown />, color: 'danger', title: 'Monthly expenses', meta: `${formatINR(expSummary?.this_month || 0)} this month` },
  ];

  return (
    <div className="page-enter">
      {/* SVG defs for ring gradients */}
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
          <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" /><stop offset="100%" stopColor="#a5b4fc" />
          </linearGradient>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
      </svg>

      {/* ─── Hero ─── */}
      <div className="dash-hero admin">
        <div className="dash-hero-inner">
          <div className="dash-hero-text">
            <h2>{getGreeting()}, {user?.first_name}! 🏫</h2>
            <p>Here's everything happening at your school today — students, staff, money & more.</p>
            <div className="dash-hero-meta">
              <span className="hero-chip"><FiZap /> Admin Control Center</span>
              <span className="hero-chip"><FiUsers /> {stats?.total_students || 0} students</span>
              <span className="hero-chip"><FiUser /> {stats?.total_teachers || 0} staff</span>
            </div>
          </div>
          <div className="hero-clock">
            <div className="time">{timeStr}</div>
            <div className="date">{dateStr}</div>
          </div>
        </div>
      </div>

      {/* ─── Metric cards ─── */}
      <div className="metric-grid">
        <div className="metric-card indigo">
          <div className="metric-top">
            <div className="metric-icon indigo"><FiUsers /></div>
            <span className="metric-trend up"><FiArrowUpRight /> Active</span>
          </div>
          <div className="metric-label">Total Students</div>
          <div className="metric-value">{stats?.total_students || 0}</div>
          <div className="metric-sub"><FiActivity size={12} /> Enrolled this session</div>
        </div>

        <div className="metric-card emerald">
          <div className="metric-top">
            <div className="metric-icon emerald"><FiUser /></div>
            <span className="metric-trend up"><FiArrowUpRight /> Staff</span>
          </div>
          <div className="metric-label">Total Teachers</div>
          <div className="metric-value">{stats?.total_teachers || 0}</div>
          <div className="metric-sub"><FiAward size={12} /> Faculty members</div>
        </div>

        <div className="metric-card amber">
          <div className="metric-top">
            <div className="metric-icon amber"><FiCheckSquare /></div>
            <span className={`metric-trend ${attTrendUp ? 'up' : 'down'}`}>
              {attTrendUp ? <FiTrendingUp /> : <FiTrendingDown />} {attPct}%
            </span>
          </div>
          <div className="metric-label">Today's Attendance</div>
          <div className="metric-value">{attPct}%</div>
          <div className="metric-sub">
            <FiUserCheck size={12} />
            {stats?.attendance_today?.present || 0}/{stats?.attendance_today?.total || 0} present
          </div>
        </div>

        <div className="metric-card rose">
          <div className="metric-top">
            <div className="metric-icon rose"><FiDollarSign /></div>
            <span className="metric-trend up"><FiTrendingUp /> Collected</span>
          </div>
          <div className="metric-label">Fees Collected</div>
          <div className="metric-value">{formatINR(stats?.total_fee_collected || 0)}</div>
          <div className="metric-sub"><FiCalendar size={12} /> All-time total</div>
        </div>
      </div>

      {/* ─── Money row ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ background: 'linear-gradient(135deg, #ecfdf5 0%, #ffffff 60%)' }}>
          <div className="card-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
            <h3 style={{ fontSize: '.9rem', display: 'flex', alignItems: 'center', gap: 6 }}>
              <FiDollarSign style={{ color: '#059669' }} /> Fee Collection
            </h3>
            <Link to="/admin/fees">View All</Link>
          </div>
          <div className="card-body" style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '.72rem', color: 'var(--gray-500)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>All-Time</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#059669', marginTop: 2 }}>{formatINR(stats?.total_fee_collected || 0)}</div>
            </div>
          </div>
        </div>

        <div className="card" style={{ background: 'linear-gradient(135deg, #fff1f2 0%, #ffffff 60%)' }}>
          <div className="card-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
            <h3 style={{ fontSize: '.9rem', display: 'flex', alignItems: 'center', gap: 6 }}>
              <FiTrendingDown style={{ color: '#e11d48' }} /> Expenses
            </h3>
            <Link to="/admin/expenses">View All</Link>
          </div>
          <div className="card-body" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {[
              { label: 'Today', value: formatINR(expSummary?.today || 0) },
              { label: 'This Month', value: formatINR(expSummary?.this_month || 0) },
              { label: 'All Time', value: formatINR(expSummary?.all_time || 0) },
            ].map(it => (
              <div key={it.label} style={{ flex: 1, minWidth: 80 }}>
                <div style={{ fontSize: '.7rem', color: 'var(--gray-500)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>{it.label}</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#e11d48', marginTop: 2 }}>{it.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ background: 'linear-gradient(135deg, #eef2ff 0%, #ffffff 60%)' }}>
          <div className="card-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
            <h3 style={{ fontSize: '.9rem', display: 'flex', alignItems: 'center', gap: 6 }}>
              <FiZap style={{ color: '#4f46e5' }} /> Quick Info
            </h3>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
            <Link to="/admin/enquiries" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--gray-700)', textDecoration: 'none', padding: '4px 0', borderBottom: '1px dashed var(--gray-100)' }}>
              <span style={{ fontSize: '.84rem', display: 'flex', alignItems: 'center', gap: 6 }}><FiMessageSquare size={13} style={{ color: '#0284c7' }} /> Open Enquiries</span>
              <span style={{ fontSize: '.85rem', fontWeight: 800 }}>—</span>
            </Link>
            <Link to="/admin/staff-attendance" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--gray-700)', textDecoration: 'none', padding: '4px 0', borderBottom: '1px dashed var(--gray-100)' }}>
              <span style={{ fontSize: '.84rem', display: 'flex', alignItems: 'center', gap: 6 }}><FiUserCheck size={13} style={{ color: '#059669' }} /> Staff Present</span>
              <span style={{ fontSize: '.85rem', fontWeight: 800 }}>—</span>
            </Link>
            <Link to="/admin/notices" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--gray-700)', textDecoration: 'none', padding: '4px 0' }}>
              <span style={{ fontSize: '.84rem', display: 'flex', alignItems: 'center', gap: 6 }}><FiGift size={13} style={{ color: '#d97706' }} /> Birthdays Today</span>
              <span style={{ fontSize: '.85rem', fontWeight: 800 }}>—</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ─── Charts + Activity feed ─── */}
      <div className="dash-main-grid">
        <div className="card">
          <div className="card-header">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="accent-bar" style={{ display: 'inline-block', width: 4, height: 18, borderRadius: 2, background: 'linear-gradient(180deg, #6366f1, #fbbf24)' }} />
              Weekly Attendance Trend
            </h3>
            <Link to="/admin/attendance">View details</Link>
          </div>
          <div className="card-body">
            <div className="chart-container" style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mockAttendanceWeek} barSize={32}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 12px 28px -10px rgba(0,0,0,.15)' }}
                    formatter={(value: any) => [`${value}%`, 'Attendance']}
                  />
                  <Bar dataKey="present" fill="url(#barGradient)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ display: 'inline-block', width: 4, height: 18, borderRadius: 2, background: 'linear-gradient(180deg, #10b981, #34d399)' }} />
              Live Activity
            </h3>
          </div>
          <div className="card-body" style={{ paddingTop: 0 }}>
            <ul className="activity-list" style={{ listStyle: 'none', padding: 0 }}>
              {recentActivities.map((a, i) => (
                <li key={i} className="activity-item">
                  <div className={`activity-icon ${a.color}`}>{a.icon}</div>
                  <div className="activity-content">
                    <div className="title">{a.title}</div>
                    <div className="meta">{a.meta}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* ─── Revenue trend ─── */}
      <div className="card" style={{ marginTop: '1.25rem' }}>
        <div className="card-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ display: 'inline-block', width: 4, height: 18, borderRadius: 2, background: 'linear-gradient(180deg, #059669, #34d399)' }} />
            Fee Collection Trend (6 months)
          </h3>
          <Link to="/admin/fees">Reports</Link>
        </div>
        <div className="card-body">
          <div className="chart-container" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockFeesTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="m" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb' }}
                  formatter={(v: any) => [formatINR(v), 'Collected']}
                />
                <Area type="monotone" dataKey="v" stroke="#10b981" strokeWidth={2.5} fill="url(#areaGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ─── Recent notices ─── */}
      {stats?.recent_notices?.length > 0 && (
        <div className="card" style={{ marginTop: '1.25rem' }}>
          <div className="card-header">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ display: 'inline-block', width: 4, height: 18, borderRadius: 2, background: 'linear-gradient(180deg, #f59e0b, #fbbf24)' }} />
              Recent Notices
            </h3>
            <Link to="/admin/notices">All Notices</Link>
          </div>
          <div className="card-body">
            <ul className="notice-list">
              {stats.recent_notices.map((n: any) => (
                <li key={n.id} className="notice-item">
                  <div className="notice-dot" />
                  <div className="notice-content">
                    <h4>{n.title}</h4>
                    <p>{new Date(n.created_at).toLocaleDateString()}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

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
