import React, { useState, useEffect } from 'react';
import { FiBarChart2, FiCheckSquare, FiAward, FiBook } from 'react-icons/fi';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import client from '../../api/client';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#3b82f6', '#8b5cf6'];

export default function StudentAnalytics() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get('/my/analytics')
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="spinner-container"><div className="spinner" /></div>;

  if (!data) return (
    <div className="page-header">
      <h1>📊 My Analytics</h1>
      <div className="empty-state">
        <FiBarChart2 style={{ fontSize: '2.5rem', color: 'var(--gray-300)' }} />
        <h3>No analytics data yet</h3>
        <p>Analytics will appear once you have attendance records and exam results.</p>
      </div>
    </div>
  );

  const { attendance, academics, grade_distribution } = data;
  const subjectData = academics?.subject_performance || [];
  const gradeData = grade_distribution || [];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>📊 My Analytics</h1>
          <p className="text-muted">Your performance overview and subject-wise analysis</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <div className="stat-card blue">
          <div className="stat-icon blue"><FiCheckSquare /></div>
          <div className="stat-info">
            <span className="label">Attendance</span>
            <span className="value">{attendance?.percentage ?? 0}%</span>
          </div>
        </div>
        <div className="stat-card green">
          <div className="stat-icon green"><FiBarChart2 /></div>
          <div className="stat-info">
            <span className="label">Overall Avg</span>
            <span className="value">{academics?.overall_average ?? 0}</span>
          </div>
        </div>
        <div className="stat-card purple">
          <div className="stat-icon purple"><FiAward /></div>
          <div className="stat-info">
            <span className="label">Exams Taken</span>
            <span className="value">{academics?.total_exams_taken ?? 0}</span>
          </div>
        </div>
        <div className="stat-card yellow">
          <div className="stat-icon yellow"><FiBook /></div>
          <div className="stat-info">
            <span className="label">Subjects</span>
            <span className="value">{subjectData.length}</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Attendance Pie */}
        <div className="card">
          <div className="card-header"><h3>Attendance Breakdown</h3></div>
          <div className="card-body" style={{ display: 'flex', justifyContent: 'center' }}>
            <PieChart width={260} height={220}>
              <Pie
                data={[
                  { name: 'Present', value: attendance?.present_days ?? 0 },
                  { name: 'Absent', value: attendance?.absent_days ?? 0 },
                ]}
                cx={130} cy={100} outerRadius={80} dataKey="value"
              >
                <Cell fill="#10b981" />
                <Cell fill="#f87171" />
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </div>
          <div style={{ textAlign: 'center', paddingBottom: '1rem' }}>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: attendance?.percentage >= 75 ? '#10b981' : '#f87171' }}>
              {attendance?.percentage ?? 0}%
            </div>
            <p className="text-muted text-sm">{attendance?.present_days ?? 0} present / {attendance?.total_days ?? 0} total days</p>
            {(attendance?.percentage ?? 0) < 75 && (
              <span className="badge badge-danger">⚠️ Below 75% — at risk</span>
            )}
          </div>
        </div>

        {/* Grade Distribution */}
        <div className="card">
          <div className="card-header"><h3>Grade Distribution</h3></div>
          <div className="card-body">
            {gradeData.length === 0 ? (
              <div className="empty-state">
                <p className="text-muted">No exam data yet</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={gradeData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="grade" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Subject Performance Bar Chart */}
      {subjectData.length > 0 && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header"><h3>Subject-wise Performance</h3></div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={subjectData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="subject" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: any) => [`${v}%`, 'Score']} />
                <Bar dataKey="percentage" radius={[4, 4, 0, 0]}>
                  {subjectData.map((_: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Subject table */}
      {subjectData.length > 0 && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header"><h3>Subject Details</h3></div>
          <div className="card-body no-padding">
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr><th>Subject</th><th>Avg Marks</th><th>Max Marks</th><th>Percentage</th><th>Grade</th></tr>
                </thead>
                <tbody>
                  {subjectData.map((s: any, i: number) => {
                    const grade = s.percentage >= 90 ? 'A+' : s.percentage >= 80 ? 'A' : s.percentage >= 70 ? 'B' : s.percentage >= 60 ? 'C' : s.percentage >= 50 ? 'D' : 'F';
                    return (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{s.subject}</td>
                        <td>{s.average_marks}</td>
                        <td>{s.max_marks}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, background: 'var(--gray-100)', borderRadius: 4, height: 8 }}>
                              <div style={{
                                width: `${s.percentage}%`,
                                background: COLORS[i % COLORS.length],
                                height: '100%', borderRadius: 4,
                              }} />
                            </div>
                            <span className="text-sm">{s.percentage}%</span>
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${grade === 'A+' || grade === 'A' ? 'badge-success' : grade === 'B' || grade === 'C' ? 'badge-warning' : 'badge-danger'}`}>
                            {grade}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
