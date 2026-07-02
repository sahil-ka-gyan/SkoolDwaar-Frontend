import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { FiAward, FiTrendingUp, FiSearch, FiBookOpen, FiLayers, FiClipboard, FiGlobe } from 'react-icons/fi';
import client from '../../api/client';
import { LeaderboardTable, PodiumStrip, RankRow } from '../../components/LeaderboardPieces';

interface ClassOpt { id: string; name: string; grade_level: number; }
interface SectionOpt { id: string; name: string; class_id: string; }
interface ExamOpt { id: string; name: string; exam_type: string; }

type Mode = 'school' | 'class';

export default function AdminLeaderboard() {
  const [mode, setMode] = useState<Mode>('school');
  const [classes, setClasses] = useState<ClassOpt[]>([]);
  const [sections, setSections] = useState<SectionOpt[]>([]);
  const [exams, setExams] = useState<ExamOpt[]>([]);
  const [classId, setClassId] = useState<string>('');
  const [sectionId, setSectionId] = useState<string>('');
  const [examId, setExamId] = useState<string>('');
  const [rankings, setRankings] = useState<RankRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [contextTotal, setContextTotal] = useState(0);

  useEffect(() => {
    client.get('/leaderboard/options').then(r => {
      setClasses(r.data?.classes || []);
      setSections(r.data?.sections || []);
      setExams(r.data?.exams || []);
    }).catch(() => {});
  }, []);

  const sectionsForClass = useMemo(
    () => sections.filter(s => s.class_id === classId),
    [sections, classId]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { limit: 200 };
      if (mode === 'class') {
        if (!classId) { setRankings([]); setLoading(false); return; }
        params.class_id = classId;
        if (sectionId) params.section_id = sectionId;
      }
      if (examId) params.exam_id = examId;
      const r = await client.get('/leaderboard', { params });
      setRankings(r.data?.rankings || []);
      setContextTotal(r.data?.context?.total_ranked || (r.data?.rankings?.length ?? 0));
    } finally {
      setLoading(false);
    }
  }, [mode, classId, sectionId, examId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => { setSectionId(''); }, [classId]);
  useEffect(() => { if (mode === 'school') { setClassId(''); setSectionId(''); } }, [mode]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rankings;
    const q = search.toLowerCase();
    return rankings.filter(r => `${r.name} ${r.admission_no} ${r.class_name || ''} ${r.section_name || ''}`.toLowerCase().includes(q));
  }, [rankings, search]);

  const top3 = useMemo(() => rankings.slice(0, 3), [rankings]);

  const selectedClassName = classes.find(c => c.id === classId)?.name;
  const selectedSectionName = sections.find(s => s.id === sectionId)?.name;
  const selectedExamName = exams.find(e => e.id === examId)?.name;

  return (
    <div className="page-enter">
      <div className="page-header">
        <div>
          <h1>🏆 School Leaderboard</h1>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.85rem', margin: '4px 0 0' }}>
            Drill down by class, section, or exam — or view the school-wide hall of fame.
          </p>
        </div>
      </div>

      {/* Mode tabs */}
      <div className="card" style={{ marginBottom: '0.75rem' }}>
        <div className="card-body" style={{ paddingBottom: 0 }}>
          <div className="tabs" style={{ marginBottom: 0 }}>
            <button className={`tab ${mode === 'school' ? 'active' : ''}`} onClick={() => setMode('school')}>
              <FiGlobe size={13} style={{ marginRight: 5 }} /> School-wide
            </button>
            <button className={`tab ${mode === 'class' ? 'active' : ''}`} onClick={() => setMode('class')}>
              <FiLayers size={13} style={{ marginRight: 5 }} /> By Class
            </button>
          </div>
        </div>

        <div className="card-body" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {mode === 'class' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: 'var(--primary-50)', borderRadius: 'var(--radius-md)' }}>
                <FiLayers style={{ color: 'var(--primary-600)' }} />
                <select value={classId} onChange={e => setClassId(e.target.value)}
                  style={{ border: 'none', background: 'transparent', fontSize: '0.88rem', fontWeight: 600, outline: 'none' }}>
                  <option value="">Select class…</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {classId && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: 'var(--success-50)', borderRadius: 'var(--radius-md)' }}>
                  <FiBookOpen style={{ color: 'var(--success-600)' }} />
                  <select value={sectionId} onChange={e => setSectionId(e.target.value)}
                    style={{ border: 'none', background: 'transparent', fontSize: '0.88rem', fontWeight: 600, outline: 'none' }}>
                    <option value="">All sections</option>
                    {sectionsForClass.map(s => <option key={s.id} value={s.id}>Section {s.name}</option>)}
                  </select>
                </div>
              )}
            </>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: 'var(--accent-50)', borderRadius: 'var(--radius-md)' }}>
            <FiClipboard style={{ color: 'var(--accent-600)' }} />
            <select value={examId} onChange={e => setExamId(e.target.value)}
              style={{ border: 'none', background: 'transparent', fontSize: '0.88rem', fontWeight: 600, outline: 'none' }}>
              <option value="">Overall (all exams)</option>
              {exams.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>

          <div style={{ flex: 1 }} />
          <div style={{ position: 'relative', minWidth: 220 }}>
            <FiSearch style={{ position: 'absolute', left: '.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
            <input type="text" placeholder="Search names…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: '2.2rem', width: '100%' }} />
          </div>
        </div>

        <div style={{ padding: '0 1.25rem 1rem', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {mode === 'school'
            ? <span className="badge badge-primary"><FiGlobe size={11} /> Whole school</span>
            : <>
                {selectedClassName && <span className="badge badge-primary">Class: {selectedClassName}</span>}
                {selectedSectionName && <span className="badge badge-success">Section: {selectedSectionName}</span>}
              </>
          }
          {selectedExamName ? <span className="badge badge-warning">Exam: {selectedExamName}</span> : <span className="badge badge-neutral"><FiTrendingUp size={11} /> Overall</span>}
          {!loading && rankings.length > 0 && <span className="badge badge-info">{contextTotal} students ranked</span>}
        </div>
      </div>

      {mode === 'class' && !classId ? (
        <div className="card">
          <div className="empty-state">
            <FiLayers size={32} style={{ color: 'var(--gray-300)' }} />
            <h3>Pick a class to start</h3>
            <p>Choose a class above, then optionally drill into a section or specific exam.</p>
          </div>
        </div>
      ) : (
        <>
          {top3.length === 3 && <PodiumStrip top3={top3} />}
          <LeaderboardTable rows={filtered} loading={loading} />
        </>
      )}
    </div>
  );
}
