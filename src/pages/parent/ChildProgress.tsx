import React, { useEffect, useState } from 'react';
import { FiBarChart2, FiCheckCircle, FiBookOpen, FiUser } from 'react-icons/fi';
import { getInitials } from '../../utils/helpers';
import client from '../../api/client';

export default function ChildProgress() {
  const [children, setChildren] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string>(() => localStorage.getItem('selectedChildId') || '');
  const [progress, setProgress] = useState<any>(null);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get('/parent/children').then(r => {
      const list = r.data || [];
      setChildren(list);
      if (list.length > 0 && (!selectedId || !list.find((c: any) => c.student_id === selectedId))) {
        setSelectedId(list[0].student_id);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    localStorage.setItem('selectedChildId', selectedId);
    Promise.all([
      client.get(`/parent/child/${selectedId}/progress`).then(r => setProgress(r.data)).catch(() => setProgress(null)),
      client.get(`/parent/child/${selectedId}/results`).then(r => setResults(r.data || [])).catch(() => setResults([])),
    ]);
  }, [selectedId]);

  const selected = children.find(c => c.student_id === selectedId);
  const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444'];

  if (loading) return <div className="spinner-container"><div className="spinner" /></div>;

  return (
    <div>
      <div className="page-header"><h1>📊 Child Progress</h1></div>

      {/* Child switcher */}
      {children.length > 0 && (
        <div className="card" style={{ marginBottom: 16, padding: 12 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {children.map((c: any, i) => {
              const active = c.student_id === selectedId;
              return (
                <button key={c.student_id} onClick={() => setSelectedId(c.student_id)} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
                  background: active ? 'var(--primary-50)' : '#fff',
                  border: active ? '2px solid var(--primary-500)' : '1px solid var(--gray-200)',
                  borderRadius: 'var(--radius-md)', cursor: 'pointer',
                }}>
                  <div className="avatar" style={{ background: colors[i % colors.length], width: 28, height: 28, fontSize: '0.75rem' }}>{getInitials(`${c.first_name || ''} ${c.last_name || ''}`)}</div>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{c.first_name} {c.last_name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!selected ? (
        <div className="card"><div className="empty-state"><FiUser size={28} style={{ color: 'var(--gray-300)' }} /><h3>No child selected</h3></div></div>
      ) : (
        <>
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="stat-card blue">
              <div className="stat-icon blue"><FiCheckCircle /></div>
              <div className="stat-info">
                <span className="label">Attendance</span>
                <span className="value">{progress?.attendance?.percentage ?? '—'}%</span>
                <span className="change" style={{ color: 'var(--text-secondary)' }}>
                  {progress?.attendance ? `${progress.attendance.present}/${progress.attendance.total} days` : '—'}
                </span>
              </div>
            </div>
            <div className="stat-card green">
              <div className="stat-icon green"><FiBookOpen /></div>
              <div className="stat-info">
                <span className="label">Avg. Marks</span>
                <span className="value">{progress?.academics?.average_marks ?? '—'}</span>
              </div>
            </div>
            <div className="stat-card amber">
              <div className="stat-icon amber"><FiBarChart2 /></div>
              <div className="stat-info">
                <span className="label">Exams Taken</span>
                <span className="value">{progress?.academics?.total_exams_taken ?? 0}</span>
              </div>
            </div>
          </div>

          <div className="card">
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gray-100)' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Recent Exam Results</h3>
            </div>
            <div className="card-body no-padding">
              {results.length === 0 ? (
                <div className="empty-state"><p>No exam results recorded yet.</p></div>
              ) : (
                <table className="data-table">
                  <thead><tr><th>Subject ID</th><th>Marks</th><th>Grade</th><th>Remarks</th></tr></thead>
                  <tbody>
                    {results.map((r: any) => (
                      <tr key={r.id}>
                        <td style={{ fontSize: '0.85rem', color: 'var(--gray-500)' }}>{r.exam_subject_id?.slice(0, 8)}…</td>
                        <td style={{ fontWeight: 700 }}>{r.marks_obtained}</td>
                        <td><span className="badge badge-info">{r.grade || '—'}</span></td>
                        <td style={{ fontSize: '0.82rem', color: 'var(--gray-500)' }}>{r.remarks || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
