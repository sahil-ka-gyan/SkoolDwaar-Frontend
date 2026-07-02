import React, { useEffect, useState } from 'react';
import { FiUsers } from 'react-icons/fi';
import client from '../../api/client';
import DiaryBook, { DiaryDay } from '../../components/DiaryBook';

interface Child {
  student_id: string;
  first_name: string;
  last_name: string;
  class_name?: string | null;
  section_name?: string | null;
  admission_no?: string | null;
}

export default function ParentDiary() {
  const [children, setChildren] = useState<Child[]>([]);
  const [childId, setChildId] = useState('');
  const [days, setDays] = useState<DiaryDay[]>([]);
  const [loading, setLoading] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);

  // Boot — load children
  useEffect(() => {
    client.get('/parent/children')
      .then(r => {
        const list: Child[] = Array.isArray(r.data) ? r.data : [];
        setChildren(list);
        if (list.length === 1) setChildId(list[0].student_id);
        else if (list.length === 0) setBootError('No children linked to your account. Please contact the school admin.');
      })
      .catch(() => setBootError('Failed to load your children.'))
      .finally(() => setBootLoading(false));
  }, []);

  // Load diary when childId changes
  useEffect(() => {
    if (!childId) { setDays([]); return; }
    setLoading(true);
    client.get(`/diary/child/${childId}`)
      .then(r => setDays(Array.isArray(r.data) ? r.data : []))
      .catch(() => setDays([]))
      .finally(() => setLoading(false));
  }, [childId]);

  const active = children.find(c => c.student_id === childId);
  const ownerName = active ? `${active.first_name} ${active.last_name}` : '';
  const ownerSub = active
    ? [active.class_name, active.section_name && `Section ${active.section_name}`].filter(Boolean).join(' · ')
    : '';

  if (bootLoading) return <div className="card"><div className="spinner-container"><div className="spinner" /></div></div>;
  if (bootError) {
    return (
      <div>
        <div className="page-header"><h1>📓 Child's Diary</h1></div>
        <div className="card"><div className="empty-state"><h3>{bootError}</h3></div></div>
      </div>
    );
  }

  return (
    <div className="diary-page">
      <div className="page-header">
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>📓 Child's Daily Diary</h1>
          <p style={{ color: 'var(--gray-500)', margin: '4px 0 0', fontSize: '0.9rem' }}>
            See exactly what was taught and the homework given today — flip through each date.
          </p>
        </div>
        {children.length > 1 && (
          <div className="actions">
            <label style={{ fontSize: '0.85rem', color: 'var(--gray-500)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <FiUsers /> Child:
            </label>
            <select
              value={childId} onChange={e => setChildId(e.target.value)}
              style={{ minWidth: 220 }}
            >
              {children.map(c => (
                <option key={c.student_id} value={c.student_id}>
                  {c.first_name} {c.last_name}{c.class_name ? ` — ${c.class_name}` : ''}{c.section_name ? ` ${c.section_name}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <DiaryBook
        days={days}
        loading={loading}
        ownerName={ownerName || 'Your child'}
        ownerSub={ownerSub || undefined}
        emptyHint="Diary entries from your child's teachers will appear here, day by day."
      />
    </div>
  );
}
