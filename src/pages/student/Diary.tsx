import React, { useEffect, useState } from 'react';
import client from '../../api/client';
import DiaryBook, { DiaryDay } from '../../components/DiaryBook';
import { useAuthStore } from '../../stores/authStore';

export default function StudentDiary() {
  const { user } = useAuthStore();
  const [days, setDays] = useState<DiaryDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<{ className?: string; sectionName?: string }>({});

  useEffect(() => {
    setLoading(true);
    client.get('/diary/my')
      .then(r => setDays(Array.isArray(r.data) ? r.data : []))
      .catch(() => setDays([]))
      .finally(() => setLoading(false));
    // First diary entry's section_label gives us "Class · Section"
  }, []);

  // Derive class/section label from any entry's section_label
  useEffect(() => {
    if (days.length > 0 && days[0].entries.length > 0) {
      const lbl = days[0].entries[0].section_label || '';
      const parts = lbl.split('·').map(s => s.trim());
      if (parts.length === 2) setMeta({ className: parts[0], sectionName: parts[1] });
      else if (lbl) setMeta({ className: lbl });
    }
  }, [days]);

  const ownerName = user ? `${user.first_name} ${user.last_name}` : 'Student';
  const ownerSub = [meta.className, meta.sectionName && `Section ${meta.sectionName}`].filter(Boolean).join(' · ');

  return (
    <div className="diary-page">
      <div className="page-header">
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>📓 My Diary</h1>
          <p style={{ color: 'var(--gray-500)', margin: '4px 0 0', fontSize: '0.9rem' }}>
            Classwork, homework and reminders posted by your teachers — flip through the pages.
          </p>
        </div>
      </div>
      <DiaryBook
        days={days}
        loading={loading}
        ownerName={ownerName}
        ownerSub={ownerSub || undefined}
        emptyHint="Once your teachers post diary entries, they will appear here, page by page."
      />
    </div>
  );
}
