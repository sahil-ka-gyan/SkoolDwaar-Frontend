import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiShield, FiArrowLeft, FiSave, FiCheck } from 'react-icons/fi';
import client from '../../api/client';

const MODULES = [
  { key: 'student', label: 'Student' },
  { key: 'batches', label: 'Batches' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'fee', label: 'Fee' },
  { key: 'expense', label: 'Expense' },
  { key: 'staff', label: 'Staff' },
  { key: 'staff_attendance', label: 'Staff Attendance' },
  { key: 'salary', label: 'Salary' },
  { key: 'exams', label: 'Exams' },
  { key: 'enquiry', label: 'Enquiry' },
  { key: 'classworks', label: 'Class Works' },
  { key: 'homework', label: 'HomeWork' },
];

type PermLevel = 'view' | 'add' | 'edit' | 'delete';
const LEVELS: { key: PermLevel; label: string; color: string }[] = [
  { key: 'view', label: 'View Permissions', color: '#6366f1' },
  { key: 'add', label: 'Add Permissions', color: '#10b981' },
  { key: 'edit', label: 'Edit Permissions', color: '#f59e0b' },
  { key: 'delete', label: 'Delete Permissions', color: '#ef4444' },
];

export default function Permissions() {
  const { teacherId } = useParams<{ teacherId: string }>();
  const navigate = useNavigate();

  const [teacher, setTeacher] = useState<any>(null);
  const [perms, setPerms] = useState<Record<PermLevel, string[]>>({ view: [], add: [], edit: [], delete: [] });
  const [sections, setSections] = useState<any[]>([]);
  const [allowedSections, setAllowedSections] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!teacherId) return;
    Promise.all([
      client.get(`/staff/${teacherId}`).then(r => setTeacher(r.data)).catch(() => {}),
      client.get(`/staff/${teacherId}/permissions`).then(r => {
        const d = r.data;
        setPerms({
          view: d.view_permissions || [],
          add: d.add_permissions || [],
          edit: d.edit_permissions || [],
          delete: d.delete_permissions || [],
        });
        setAllowedSections(d.allowed_sections || []);
      }).catch(() => {}),
      client.get('/classes').then(r => {
        // Also fetch sections for each class
        const classes = r.data || [];
        const sectionPromises = classes.map((c: any) =>
          client.get(`/classes/${c.id}/sections`).then(sr => sr.data || []).catch(() => [])
        );
        return Promise.all(sectionPromises).then(results => {
          setSections(results.flat());
        });
      }).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [teacherId]);

  const toggle = (level: PermLevel, mod: string) => {
    setPerms(prev => {
      const has = prev[level].includes(mod);
      return { ...prev, [level]: has ? prev[level].filter(m => m !== mod) : [...prev[level], mod] };
    });
  };

  const toggleSection = (id: string) => {
    setAllowedSections(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await client.put(`/staff/${teacherId}/permissions`, {
        view: perms.view,
        add: perms.add,
        edit: perms.edit,
        delete: perms.delete,
        allowed_sections: allowedSections,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {}
    setSaving(false);
  };

  if (loading) return <div className="spinner-container"><div className="spinner" /></div>;

  const teacherName = teacher ? `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim() : 'Teacher';

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn-icon" onClick={() => navigate(-1)} title="Back">
            <FiArrowLeft />
          </button>
          <div>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FiShield style={{ color: 'var(--primary-600)' }} />
              Permissions — {teacherName}
            </h1>
            {teacher && <p style={{ color: 'var(--gray-500)', fontSize: '0.85rem', marginTop: 2 }}>Employee ID: {teacher.employee_id}</p>}
          </div>
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          {saved ? <><FiCheck /> Saved!</> : <><FiSave /> {saving ? 'Saving...' : 'Save Permissions'}</>}
        </button>
      </div>

      <div style={{ display: 'grid', gap: '1.25rem' }}>
        {LEVELS.map(level => (
          <div className="card" key={level.key}>
            <div className="card-header" style={{ borderLeft: `4px solid ${level.color}`, paddingLeft: '1rem' }}>
              <h3 style={{ color: level.color }}>{level.label}</h3>
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
                {MODULES.map(mod => {
                  const active = perms[level.key].includes(mod.key);
                  return (
                    <button
                      key={mod.key}
                      onClick={() => toggle(level.key, mod.key)}
                      style={{
                        padding: '6px 16px',
                        borderRadius: 'var(--radius-full)',
                        border: `1.5px solid ${active ? level.color : 'var(--gray-200)'}`,
                        background: active ? level.color + '18' : '#fff',
                        color: active ? level.color : 'var(--gray-500)',
                        fontWeight: active ? 600 : 400,
                        fontSize: '0.83rem',
                        cursor: 'pointer',
                        transition: 'all .15s',
                        display: 'flex', alignItems: 'center', gap: 5,
                      }}
                    >
                      {active && <FiCheck size={12} />}
                      {mod.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ))}

        {/* Allowed Sections/Batches */}
        <div className="card">
          <div className="card-header" style={{ borderLeft: '4px solid #0ea5e9', paddingLeft: '1rem' }}>
            <h3 style={{ color: '#0ea5e9' }}>Allowed Batches</h3>
            <p style={{ color: 'var(--gray-400)', fontSize: '0.82rem', marginTop: 2 }}>
              Leave all unchecked to allow access to all batches
            </p>
          </div>
          <div className="card-body">
            {sections.length === 0 ? (
              <p style={{ color: 'var(--gray-400)', fontSize: '0.85rem' }}>No sections found</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.6rem' }}>
                {sections.map((sec: any) => {
                  const checked = allowedSections.includes(sec.id);
                  return (
                    <label key={sec.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 12px', borderRadius: 'var(--radius-md)',
                      border: `1.5px solid ${checked ? '#0ea5e9' : 'var(--gray-200)'}`,
                      background: checked ? '#f0f9ff' : '#fff',
                      cursor: 'pointer', transition: 'all .15s',
                    }}>
                      <input type="checkbox" checked={checked} onChange={() => toggleSection(sec.id)} style={{ accentColor: '#0ea5e9', width: 15, height: 15 }} />
                      <span style={{ fontSize: '0.85rem', fontWeight: checked ? 600 : 400, color: checked ? '#0284c7' : 'var(--gray-600)' }}>
                        {sec.class_name || ''} {sec.name}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {saved && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24,
          background: 'var(--success-500)', color: '#fff',
          padding: '12px 20px', borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-lg)', display: 'flex', alignItems: 'center', gap: 8,
          fontSize: '0.9rem', fontWeight: 600, zIndex: 2000,
        }}>
          <FiCheck /> Permissions saved successfully!
        </div>
      )}
    </div>
  );
}
