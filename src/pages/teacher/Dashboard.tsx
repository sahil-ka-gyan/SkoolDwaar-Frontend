import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiCheckSquare, FiFileText, FiBarChart2, FiBell, FiClock, FiUsers, FiBook, FiAward, FiLayers } from 'react-icons/fi';
import { useAuthStore } from '../../stores/authStore';
import { getGreeting } from '../../utils/helpers';
import client from '../../api/client';

export default function TeacherDashboard() {
  const { user } = useAuthStore();
  const [myClasses, setMyClasses] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get('/staff/my/classes')
      .then(res => setMyClasses(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="spinner-container"><div className="spinner" /></div>;

  const quickActions = [
    { icon: <FiCheckSquare />, label: 'Mark Attendance', path: '/teacher/attendance', bg: 'var(--success-50)', color: 'var(--success-600)' },
    { icon: <FiFileText />,    label: 'Daily Diary',     path: '/teacher/diary', bg: 'var(--primary-50)', color: 'var(--primary-600)' },
    { icon: <FiBarChart2 />,   label: 'Enter Results',   path: '/teacher/results',     bg: 'var(--accent-50)', color: 'var(--accent-600)' },
    { icon: <FiBell />,        label: 'Notices',         path: '/teacher/notices',     bg: '#f5f3ff',          color: '#7c3aed' },
    { icon: <FiClock />,       label: 'Apply Leave',     path: '/teacher/leave',       bg: 'var(--warning-50)', color: 'var(--warning-600)' },
  ];

  const summary = myClasses?.summary || {};
  const classes = myClasses?.classes || [];
  const classTeacherOf = myClasses?.class_teacher_of || [];

  return (
    <div>
      <div className="welcome-banner">
        <h2>{getGreeting()}, {user?.first_name}! 👨‍🏫</h2>
        <p>{summary.class_count > 0 ? `You teach ${summary.subject_count} subject${summary.subject_count === 1 ? '' : 's'} across ${summary.class_count} class${summary.class_count === 1 ? '' : 'es'}` : 'Ready to inspire your students today?'}</p>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-card blue">
          <div className="stat-icon blue"><FiCheckSquare /></div>
          <div className="stat-info">
            <span className="label">Employee ID</span>
            <span className="value" style={{ fontSize: '1.1rem' }}>{myClasses?.teacher?.employee_id || '—'}</span>
            <span className="change" style={{ color: 'var(--text-secondary)' }}>{myClasses?.teacher?.department || ''}</span>
          </div>
        </div>
        <div className="stat-card green">
          <div className="stat-icon green"><FiLayers /></div>
          <div className="stat-info">
            <span className="label">My Classes</span>
            <span className="value">{summary.class_count || 0}</span>
          </div>
        </div>
        <div className="stat-card amber">
          <div className="stat-icon amber"><FiBook /></div>
          <div className="stat-info">
            <span className="label">Subjects</span>
            <span className="value">{summary.subject_count || 0}</span>
          </div>
        </div>
        <div className="stat-card red">
          <div className="stat-icon red"><FiAward /></div>
          <div className="stat-info">
            <span className="label">Class Teacher Of</span>
            <span className="value">{summary.sections_as_class_teacher || 0}</span>
            <span className="change" style={{ color: 'var(--text-secondary)' }}>section{(summary.sections_as_class_teacher || 0) === 1 ? '' : 's'}</span>
          </div>
        </div>
      </div>

      {/* Class Teacher Of (priority) */}
      {classTeacherOf.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FiAward style={{ color: 'var(--primary-600)' }} />
            <h3 style={{ margin: 0, fontSize: '1rem' }}>You are Class Teacher of</h3>
          </div>
          <div className="card-body" style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {classTeacherOf.map((ct: any) => (
              <div key={ct.section_id} style={{
                padding: '12px 16px',
                background: 'linear-gradient(135deg, var(--primary-50) 0%, #ffffff 100%)',
                border: '1.5px solid var(--primary-200)',
                borderRadius: 'var(--radius-md)',
                minWidth: 180,
              }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--primary-600)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Class Teacher</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--primary-700)', marginTop: 2 }}>
                  {ct.class_name} – {ct.section_name}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--gray-500)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <FiUsers size={11} /> {ct.student_count} student{ct.student_count === 1 ? '' : 's'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* My Classes & Subjects */}
      {classes.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FiLayers style={{ color: 'var(--success-600)' }} />
            <h3 style={{ margin: 0, fontSize: '1rem' }}>My Classes & Subjects</h3>
          </div>
          <div className="card-body no-padding">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Subjects I Teach</th>
                  <th>Role</th>
                </tr>
              </thead>
              <tbody>
                {classes.map((c: any) => (
                  <tr key={c.class_id}>
                    <td>
                      <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{c.class_name}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--gray-400)' }}>Grade {c.grade_level}</div>
                    </td>
                    <td>
                      {c.subjects.length === 0 ? (
                        <span style={{ fontSize: '0.78rem', color: 'var(--gray-400)' }}>— Not teaching a subject here —</span>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {c.subjects.map((s: any) => (
                            <span key={s.id} className="badge" style={{ background: 'var(--success-50)', color: 'var(--success-700)', border: '1px solid var(--success-200)', fontSize: '0.72rem' }}>
                              <FiBook size={9} style={{ verticalAlign: -1, marginRight: 2 }} /> {s.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td>
                      {c.is_class_teacher_of_sections.length > 0 ? (
                        <span className="badge" style={{ background: 'var(--primary-100, #dbeafe)', color: 'var(--primary-700)', fontSize: '0.72rem', fontWeight: 700 }}>
                          ⭐ Class Teacher · Section {c.is_class_teacher_of_sections.join(', ')}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.74rem', color: 'var(--gray-400)' }}>Subject Teacher</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header"><h3>⚡ Quick Actions</h3></div>
        <div className="card-body">
          <div className="quick-grid">
            {quickActions.map(qa => (
              <Link key={qa.path} to={qa.path} className="quick-card">
                <div className="qc-icon" style={{ background: qa.bg, color: qa.color }}>{qa.icon}</div>
                <span className="qc-label">{qa.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
