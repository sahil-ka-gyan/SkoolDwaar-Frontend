import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { FiAward, FiTrendingUp, FiSearch, FiBookOpen } from 'react-icons/fi';
import client from '../../api/client';
import { getInitials } from '../../utils/helpers';
import { LeaderboardTable, PodiumStrip, MyStandingCard, RankRow } from '../../components/LeaderboardPieces';

interface ExamOption {
  exam_id: string;
  exam_name: string;
  exam_type: string;
}

type Scope = 'overall' | 'exam';

export default function StudentLeaderboard() {
  const [scope, setScope] = useState<Scope>('overall');
  const [examOptions, setExamOptions] = useState<ExamOption[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [rankings, setRankings] = useState<RankRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [contextTotal, setContextTotal] = useState(0);
  const [myClass, setMyClass] = useState<{ class_id?: string; class_name?: string; section_name?: string }>({});

  // Resolve student's own class on mount
  useEffect(() => {
    client.get('/dashboard').then(r => {
      setMyClass({
        class_id: r.data?.class_id,
        class_name: r.data?.class_name,
        section_name: r.data?.section_name,
      });
    }).catch(() => {});
  }, []);

  // Load exam options
  useEffect(() => {
    client.get('/my/exam-results').then(r => {
      const list = Array.isArray(r.data) ? r.data : [];
      setExamOptions(list.map((e: any) => ({
        exam_id: e.exam_id,
        exam_name: e.exam_name,
        exam_type: e.exam_type,
      })));
    }).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    if (!myClass.class_id) { setLoading(false); return; }
    setLoading(true);
    try {
      const params: any = { limit: 100, class_id: myClass.class_id };
      if (scope === 'exam' && selectedExamId) params.exam_id = selectedExamId;
      const r = await client.get('/leaderboard', { params });
      setRankings(r.data?.rankings || []);
      setContextTotal(r.data?.context?.total_ranked || (r.data?.rankings?.length ?? 0));
    } finally {
      setLoading(false);
    }
  }, [scope, selectedExamId, myClass.class_id]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rankings;
    const q = search.toLowerCase();
    return rankings.filter(r => `${r.name} ${r.admission_no} ${r.section_name || ''}`.toLowerCase().includes(q));
  }, [rankings, search]);

  const me = useMemo(() => rankings.find(r => r.is_me), [rankings]);
  const top3 = useMemo(() => rankings.slice(0, 3), [rankings]);

  return (
    <div className="page-enter">
      <div className="page-header">
        <div>
          <h1>🏆 Class Leaderboard</h1>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.85rem', margin: '4px 0 0' }}>
            {myClass.class_name ? (
              <>Ranked against everyone in <strong>Class {myClass.class_name}</strong> (all sections combined)</>
            ) : (
              <>Class rankings based on exam performance</>
            )}
          </p>
        </div>
      </div>

      {/* Scope picker */}
      <div className="card" style={{ marginBottom: '0.75rem' }}>
        <div className="card-body" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="tabs" style={{ borderBottom: 'none', marginBottom: 0 }}>
            <button className={`tab ${scope === 'overall' ? 'active' : ''}`} onClick={() => setScope('overall')}>
              <FiTrendingUp size={13} style={{ marginRight: 5 }} /> Overall
            </button>
            <button className={`tab ${scope === 'exam' ? 'active' : ''}`} onClick={() => setScope('exam')}>
              <FiAward size={13} style={{ marginRight: 5 }} /> By Exam
            </button>
          </div>
          {scope === 'exam' && (
            <select value={selectedExamId} onChange={e => setSelectedExamId(e.target.value)}
              style={{ padding: '6px 10px', border: '1.5px solid var(--gray-200)', borderRadius: 'var(--radius-md)', fontSize: '0.88rem' }}>
              <option value="">Select an exam…</option>
              {examOptions.map(e => <option key={e.exam_id} value={e.exam_id}>{e.exam_name}</option>)}
            </select>
          )}
          <div style={{ flex: 1 }} />
          <div style={{ position: 'relative', minWidth: 220 }}>
            <FiSearch style={{ position: 'absolute', left: '.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
            <input type="text" placeholder="Search names…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: '2.2rem', width: '100%' }} />
          </div>
        </div>
      </div>

      {!myClass.class_id && !loading && (
        <div className="card">
          <div className="empty-state">
            <FiBookOpen size={32} style={{ color: 'var(--gray-300)' }} />
            <h3>Class not assigned</h3>
            <p>You haven't been assigned to a class yet. Please contact the school admin.</p>
          </div>
        </div>
      )}

      {me && <MyStandingCard me={me} total={contextTotal} />}

      {top3.length === 3 && <PodiumStrip top3={top3} />}

      <LeaderboardTable rows={filtered} loading={loading} emptyHint={scope === 'exam' && !selectedExamId ? 'Pick an exam to see rankings' : 'No rankings yet'} />
    </div>
  );
}
