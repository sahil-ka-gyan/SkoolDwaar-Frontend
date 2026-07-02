import React, { useEffect, useState } from 'react';
import client from '../../api/client';
import { TimetableManager } from '../admin/Timetable';

export default function TeacherTimetable() {
  const [sections, setSections] = useState<{ id: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    client.get('/staff/my/classes')
      .then(r => {
        const ct = r.data?.class_teacher_of || [];
        const mapped = ct.map((s: any) => ({
          id: s.section_id,
          label: `${s.class_name} — Section ${s.section_name} (${s.student_count} students)`,
        }));
        setSections(mapped);
        if (mapped.length === 0) setError('You are not assigned as class teacher for any section. Ask your admin to assign you.');
      })
      .catch(() => setError('Failed to load your sections.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="card"><div className="spinner-container"><div className="spinner" /></div></div>;
  if (error) {
    return (
      <div>
        <div className="page-header"><h1>📅 Timetable & Periods</h1></div>
        <div className="card"><div className="empty-state"><h3>{error}</h3></div></div>
      </div>
    );
  }

  return (
    <TimetableManager
      sectionsOverride={sections}
      title="Timetable & Periods"
      subtitle="View the daily schedule for your section. Only your school admin can change slots."
      viewOnly
    />
  );
}
